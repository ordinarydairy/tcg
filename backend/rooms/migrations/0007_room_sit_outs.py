from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rooms', '0006_game_exchange_flow'),
    ]

    operations = [
        migrations.AddField(
            model_name='room',
            name='current_sit_out_ids',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
