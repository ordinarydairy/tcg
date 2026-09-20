import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cards', '0004_alter_packpull_options'),
        ('cards', '0005_card_creator'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='MysteryPackEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('card', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='pack_entry',
                    to='cards.card',
                )),
                ('donor', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='pack_donations',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
    ]
