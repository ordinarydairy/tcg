from django.contrib.auth import authenticate, get_user_model
from django.db.models import Q
from rest_framework import serializers

from .models import Friendship

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    profile_photo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'email', 'display_name', 'profile_photo', 'bio')
        read_only_fields = ('id', 'email', 'display_name', 'profile_photo')

    def get_profile_photo(self, user):
        return f'/api/users/{user.id}/photo/' if user.profile_photo else None


class PlayerSerializer(serializers.ModelSerializer):
    friendship_status = serializers.SerializerMethodField()
    profile_photo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'display_name', 'profile_photo', 'friendship_status')
        read_only_fields = fields

    def get_profile_photo(self, player):
        return f'/api/users/{player.id}/photo/' if player.profile_photo else None

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
        return User.objects.create_user(**validated_data)


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('bio',)

    def validate_bio(self, value):
        return value.strip()[:500]


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
