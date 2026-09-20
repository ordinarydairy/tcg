import os

import psycopg
from django.core.management.base import BaseCommand, CommandError

from cards.images import compress_image_bytes

SKIP_TABLES = {'spatial_ref_sys'}
IMAGE_DATA_TABLE = 'cards_card'
IMAGE_DATA_COLUMN = 'image_data'


def quote_ident(name):
    return '"' + name.replace('"', '""') + '"'


def table_list(cursor):
    cursor.execute(
        """
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
        """
    )
    return [row[0] for row in cursor.fetchall() if row[0] not in SKIP_TABLES]


def column_names(cursor, table):
    cursor.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
        """,
        (table,),
    )
    return [row[0] for row in cursor.fetchall()]


def reset_sequences(dest, tables):
    with dest.cursor() as cursor:
        for table in tables:
            cursor.execute("SELECT pg_get_serial_sequence(%s, 'id')", (table,))
            sequence = cursor.fetchone()[0]
            if not sequence:
                continue
            cursor.execute(f'SELECT COALESCE(MAX(id), 1) FROM {quote_ident(table)}')
            max_id = cursor.fetchone()[0]
            cursor.execute('SELECT setval(%s, %s, true)', (sequence, max_id))


class Command(BaseCommand):
    help = (
        'Copy rows from SOURCE_DATABASE_URL into the current database, '
        'compressing cards_card.image_data so photos do not refill the quota.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--source',
            default=os.getenv('SOURCE_DATABASE_URL') or os.getenv('OLD_DATABASE_URL') or '',
            help='Postgres URL for the previous Neon project',
        )
        parser.add_argument(
            '--keep-blobs',
            action='store_true',
            help='Copy uncompressed image_data instead of JPEG-compacting it',
        )

    def handle(self, *args, **options):
        source_url = (options['source'] or '').strip()
        dest_url = (
            os.getenv('DATABASE_URL_UNPOOLED')
            or os.getenv('DATABASE_URL')
            or ''
        ).strip()
        if not source_url:
            raise CommandError(
                'Set SOURCE_DATABASE_URL or pass --source with the old Neon connection string.'
            )
        if not dest_url:
            raise CommandError('DATABASE_URL is not set for the destination Neon database.')

        with psycopg.connect(source_url, autocommit=False) as src, psycopg.connect(
            dest_url, autocommit=False
        ) as dest:
            with src.cursor() as source_cursor, dest.cursor() as dest_cursor:
                tables = table_list(source_cursor)
                dest_cursor.execute('SET session_replication_role = replica')
                for table in reversed(tables):
                    dest_cursor.execute(f'TRUNCATE TABLE {quote_ident(table)} CASCADE')

                for table in tables:
                    columns = column_names(source_cursor, table)
                    if not columns:
                        continue
                    compact_blobs = (
                        table == IMAGE_DATA_TABLE
                        and IMAGE_DATA_COLUMN in columns
                        and not options['keep_blobs']
                    )
                    placeholders = ', '.join(['%s'] * len(columns))
                    quoted = ', '.join(quote_ident(name) for name in columns)
                    source_cursor.execute(
                        f'SELECT {quoted} FROM {quote_ident(table)}'
                    )
                    blob_index = columns.index(IMAGE_DATA_COLUMN) if compact_blobs else -1
                    copied = 0
                    while True:
                        rows = source_cursor.fetchmany(25)
                        if not rows:
                            break
                        prepared = []
                        for row in rows:
                            values = list(row)
                            if blob_index >= 0 and values[blob_index]:
                                try:
                                    values[blob_index] = compress_image_bytes(values[blob_index])
                                except Exception as error:
                                    self.stderr.write(
                                        f'{table} image compress failed; storing original ({error})'
                                    )
                            prepared.append(tuple(values))
                        dest_cursor.executemany(
                            f'INSERT INTO {quote_ident(table)} ({quoted}) '
                            f'OVERRIDING SYSTEM VALUE VALUES ({placeholders})',
                            prepared,
                        )
                        copied += len(prepared)
                    extra = ' (photos JPEG-compacted)' if compact_blobs else ''
                    self.stdout.write(f'{table}: {copied} rows{extra}')

                dest_cursor.execute('SET session_replication_role = origin')
            reset_sequences(dest, tables)
            dest.commit()
        self.stdout.write('Copy finished. Point the app DATABASE_URL at the new project.')
