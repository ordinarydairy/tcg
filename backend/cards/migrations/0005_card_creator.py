from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def fill_card_creators(apps, schema_editor):
    Card = apps.get_model('cards', 'Card')
    PackPull = apps.get_model('cards', 'PackPull')
    pull_creators = {
        pull.card_id: pull.from_user_id
        for pull in PackPull.objects.all()
    }
    for card in Card.objects.all():
        card.creator_id = pull_creators.get(card.id) or card.owner_id
        card.save(update_fields=['creator'])


class Migration(migrations.Migration):

    dependencies = [
        ('cards', '0004_trade'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='card',
            name='creator',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='created_cards',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(fill_card_creators, migrations.RunPython.noop),
    ]
