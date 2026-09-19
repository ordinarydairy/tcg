from django.db import models

# Create your models here.

class Card(models.Model):
    image = models.ImageField(upload_to="cards/")
    story = models.TextField(blank=True)

    photo_quality = models.IntegerField()
    location_significance = models.IntegerField()
    occasion = models.IntegerField()
    uniqueness = models.IntegerField()
    memory_story = models.IntegerField()

    overall_score = models.IntegerField()
    rarity = models.CharField(max_length=20)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.rarity} Card ({self.overall_score}/100)"