# backend/users/serializers.py
import re
from django.contrib.auth import get_user_model, authenticate
from rest_framework import serializers

User = get_user_model()

USERNAME_RE = re.compile(r'^[A-Za-z][A-Za-z0-9]{3,19}$')
PASSWORD_RE = re.compile(r'^(?=.{6,}$)(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$')

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'password', 'email', 'first_name', 'last_name')

    def validate_username(self, value):
        if not USERNAME_RE.match(value):
            raise serializers.ValidationError("Логин: латинские буквы/цифры, первая буква, длина 4-20.")
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Пользователь с таким логином уже существует.")
        return value

    def validate_password(self, value):
        if not PASSWORD_RE.match(value):
            raise serializers.ValidationError(
                "Пароль: минимум 6 символов, как минимум одна заглавная буква, одна цифра и один специальный символ."
            )
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(username=attrs['username'], password=attrs['password'])
        if not user:
            raise serializers.ValidationError("Неверные логин или пароль.")
        attrs['user'] = user
        return attrs
