from django.db import migrations, models

from accounts.models import generate_player_tag


def fill_player_tags(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    used = set(User.objects.exclude(tag__isnull=True).exclude(tag='').values_list('tag', flat=True))
    for user in User.objects.filter(models.Q(tag__isnull=True) | models.Q(tag='')):
        tag = generate_player_tag()
        while tag in used:
            tag = generate_player_tag()
        user.tag = tag
        user.save(update_fields=['tag'])
        used.add(tag)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_merge_bio_and_friendship'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='tag',
            field=models.CharField(blank=True, max_length=8, null=True),
        ),
        migrations.RunPython(fill_player_tags, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='user',
            name='tag',
            field=models.CharField(default=generate_player_tag, editable=False, max_length=8, unique=True),
        ),
    ]
