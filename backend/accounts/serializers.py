from django.contrib.auth import authenticate, get_user_model
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'display_name', 'profile_photo')
        read_only_fields = fields


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


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get('request'),
            email=attrs.get('email'),
            password=attrs.get('password'),
        )
        if user is None:
            raise serializers.ValidationError('Invalid email or password.')
        attrs['user'] = user
        return attrs
