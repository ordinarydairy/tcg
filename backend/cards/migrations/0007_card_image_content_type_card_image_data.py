from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cards', '0006_merge_0004_alter_packpull_options_0005_card_creator'),
        ('cards', '0006_mysterypackentry'),
    ]

    operations = [
        migrations.AddField(
            model_name='card',
            name='image_content_type',
            field=models.CharField(default='image/jpeg', max_length=100),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='card',
            name='image_data',
            field=models.BinaryField(blank=True, null=True),
        ),
    ]
