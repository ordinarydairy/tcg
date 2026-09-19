import cards.models
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def delete_existing_cards(apps, schema_editor):
    Card = apps.get_model('cards', 'Card')
    Card.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('cards', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(delete_existing_cards, migrations.RunPython.noop),
        migrations.AddField(
            model_name='card',
            name='owner',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='cards',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name='card',
            name='image',
            field=models.ImageField(
                storage=cards.models.card_storage,
                upload_to=cards.models.card_upload_to,
            ),
        ),
    ]
