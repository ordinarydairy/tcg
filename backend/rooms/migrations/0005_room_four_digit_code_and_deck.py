import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def clear_existing_rooms(apps, schema_editor):
    Room = apps.get_model('rooms', 'Room')
    Room.objects.all().delete()


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('cards', '0009_allow_null_score_reasons'),
        ('rooms', '0004_exchangeround_user_one_gives_card_and_more'),
    ]

    operations = [
        migrations.RunPython(clear_existing_rooms, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='room',
            name='code',
            field=models.CharField(max_length=4, unique=True),
        ),
        migrations.CreateModel(
            name='RoomDeckCard',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('card', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='+', to='cards.card')),
                ('room', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='deck_cards', to='rooms.room')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='room_deck_cards', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddConstraint(
            model_name='roomdeckcard',
            constraint=models.UniqueConstraint(fields=('room', 'user', 'card'), name='unique_room_deck_card'),
        ),
    ]
