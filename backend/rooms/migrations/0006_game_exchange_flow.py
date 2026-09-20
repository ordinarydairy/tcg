import django.db.models.deletion
from django.db import migrations, models


def clear_exchanges(apps, schema_editor):
    ExchangeRound = apps.get_model('rooms', 'ExchangeRound')
    ExchangeRound.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('cards', '0009_allow_null_score_reasons'),
        ('rooms', '0005_room_four_digit_code_and_deck'),
    ]

    operations = [
        migrations.RunPython(clear_exchanges, migrations.RunPython.noop),
        migrations.AddField(
            model_name='room',
            name='blocked_card_ids',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='room',
            name='game_over',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='exchangeround',
            name='matched_card_one',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='+',
                to='cards.card',
            ),
        ),
        migrations.AddField(
            model_name='exchangeround',
            name='matched_card_two',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='+',
                to='cards.card',
            ),
        ),
        migrations.AddField(
            model_name='exchangeround',
            name='connection_note',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='exchangeround',
            name='user_one_wants_trade',
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='exchangeround',
            name='user_two_wants_trade',
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='exchangeround',
            name='trade_completed',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='exchangeround',
            name='user_one_ready',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='exchangeround',
            name='user_two_ready',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='exchangeround',
            name='status',
            field=models.CharField(
                choices=[
                    ('icebreaker', 'Icebreaker'),
                    ('trade', 'Trade'),
                    ('between_rounds', 'Between rounds'),
                    ('done', 'Done'),
                ],
                default='icebreaker',
                max_length=20,
            ),
        ),
        migrations.RemoveField(
            model_name='exchangeround',
            name='user_one_gives_card',
        ),
        migrations.RemoveField(
            model_name='exchangeround',
            name='user_one_wants_card',
        ),
        migrations.RemoveField(
            model_name='exchangeround',
            name='user_two_gives_card',
        ),
        migrations.RemoveField(
            model_name='exchangeround',
            name='user_two_wants_card',
        ),
    ]
