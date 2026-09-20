from django.contrib import admin

from .models import MysteryPackEntry, Trade, TradeItem


@admin.register(Trade)
class TradeAdmin(admin.ModelAdmin):
    list_display = ('id', 'initiator', 'partner', 'status', 'initiator_accepted', 'partner_accepted', 'updated_at')
    list_filter = ('status',)


@admin.register(TradeItem)
class TradeItemAdmin(admin.ModelAdmin):
    list_display = ('trade', 'card', 'offered_by')


@admin.register(MysteryPackEntry)
class MysteryPackEntryAdmin(admin.ModelAdmin):
    list_display = ('id', 'donor', 'card', 'created_at')
