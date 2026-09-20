from django.contrib import admin

from .models import Trade, TradeItem


@admin.register(Trade)
class TradeAdmin(admin.ModelAdmin):
    list_display = ('id', 'initiator', 'partner', 'status', 'initiator_accepted', 'partner_accepted', 'updated_at')
    list_filter = ('status',)


@admin.register(TradeItem)
class TradeItemAdmin(admin.ModelAdmin):
    list_display = ('trade', 'card', 'offered_by')
