from pathlib import Path

from django.contrib.auth import authenticate, get_user_model
from django.db.models import Q
from rest_framework import serializers

from cards.images import compress_uploaded_image

from .models import Friendship

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    profile_photo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'email', 'display_name', 'tag', 'profile_photo', 'bio')
        read_only_fields = ('id', 'email', 'tag', 'profile_photo')

    def get_profile_photo(self, user):
        if not user.profile_photo:
            return None
        version = Path(user.profile_photo.name).stem
        return f'/api/users/{user.id}/photo/?v={version}'


class PlayerSerializer(serializers.ModelSerializer):
    friendship_status = serializers.SerializerMethodField()
    profile_photo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'display_name', 'tag', 'profile_photo', 'bio', 'friendship_status')
        read_only_fields = fields

    def get_profile_photo(self, player):
        if not player.profile_photo:
            return None
        version = Path(player.profile_photo.name).stem
        return f'/api/users/{player.id}/photo/?v={version}'

    def get_friendship_status(self, player):
        viewer = self.context.get('viewer')
        if viewer is None or viewer.id == player.id:
            return 'self'
        link = Friendship.objects.filter(
            Q(from_user=viewer, to_user=player) | Q(from_user=player, to_user=viewer)
        ).first()
        if link is None:
            return 'none'
        if link.status == Friendship.ACCEPTED:
            return 'friends'
        if link.from_user_id == viewer.id:
            return 'pending_sent'
        return 'pending_received'


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, style={'input_type': 'password'})
    profile_photo = serializers.ImageField()

    class Meta:
        model = User
        fields = ('email', 'password', 'display_name', 'profile_photo')

    def validate_display_name(self, value):
        name = value.strip()
        if len(name) < 2:
            raise serializers.ValidationError('Display name must be at least 2 characters.')
        return name

    def create(self, validated_data):
        photo = validated_data.get('profile_photo')
        if photo:
            compressed, _payload = compress_uploaded_image(photo, max_side=800, quality=82)
            validated_data['profile_photo'] = compressed
        return User.objects.create_user(**validated_data)


class ProfileUpdateSerializer(serializers.ModelSerializer):
    profile_photo = serializers.ImageField(required=False)

    class Meta:
        model = User
        fields = ('bio', 'display_name', 'profile_photo')

    def validate_bio(self, value):
        return value.strip()[:500]

    def validate_display_name(self, value):
        name = value.strip()
        if len(name) < 2:
            raise serializers.ValidationError('Display name must be at least 2 characters.')
        return name

    def update(self, instance, validated_data):
        photo = validated_data.get('profile_photo')
        if photo:
            if instance.profile_photo:
                instance.profile_photo.delete(save=False)
            compressed, _payload = compress_uploaded_image(photo, max_side=800, quality=82)
            validated_data['profile_photo'] = compressed
        return super().update(instance, validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate(self, attrs):
        email = attrs.get('email')
        if not User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                {'email': 'No account is connected to this email.'}
            )
        user = authenticate(
            request=self.context.get('request'),
            email=email,
            password=attrs.get('password'),
        )
        if user is None:
            raise serializers.ValidationError(
                {'password': 'Incorrect password.'}
            )
        attrs['user'] = user
        return attrs
