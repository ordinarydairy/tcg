from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cards', '0008_card_location_significance_reason_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='card',
            name='location_significance_reason',
            field=models.TextField(blank=True, default='', null=True),
        ),
        migrations.AlterField(
            model_name='card',
            name='memory_story_reason',
            field=models.TextField(blank=True, default='', null=True),
        ),
        migrations.AlterField(
            model_name='card',
            name='occasion_reason',
            field=models.TextField(blank=True, default='', null=True),
        ),
        migrations.AlterField(
            model_name='card',
            name='photo_quality_reason',
            field=models.TextField(blank=True, default='', null=True),
        ),
        migrations.AlterField(
            model_name='card',
            name='uniqueness_reason',
            field=models.TextField(blank=True, default='', null=True),
        ),
    ]
