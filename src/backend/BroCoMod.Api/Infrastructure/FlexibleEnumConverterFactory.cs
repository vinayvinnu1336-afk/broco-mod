using System.Text.Json;
using System.Text.Json.Serialization;

namespace BroCoMod.Api.Infrastructure;

/// <summary>
/// Lets request bodies carry enum values either as numbers (2) or as names ("Labour", "labour"),
/// while responses keep writing numbers so existing clients see exactly the same output.
/// Without this, any client sending enum names (the web app does) gets a 400.
/// </summary>
public sealed class FlexibleEnumConverterFactory : JsonConverterFactory
{
    public override bool CanConvert(Type typeToConvert)
    {
        var type = Nullable.GetUnderlyingType(typeToConvert) ?? typeToConvert;
        return type.IsEnum;
    }

    public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options)
    {
        var underlying = Nullable.GetUnderlyingType(typeToConvert);
        if (underlying != null)
        {
            return (JsonConverter)Activator.CreateInstance(typeof(NullableConverter<>).MakeGenericType(underlying))!;
        }

        return (JsonConverter)Activator.CreateInstance(typeof(Converter<>).MakeGenericType(typeToConvert))!;
    }

    private sealed class Converter<T> : JsonConverter<T> where T : struct, Enum
    {
        public override T Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            switch (reader.TokenType)
            {
                case JsonTokenType.Number when reader.TryGetInt32(out var number):
                    return (T)Enum.ToObject(typeof(T), number);
                case JsonTokenType.String:
                    var text = reader.GetString();
                    if (int.TryParse(text, out var numeric))
                    {
                        return (T)Enum.ToObject(typeof(T), numeric);
                    }
                    var normalised = text?.Replace("_", string.Empty).Replace(" ", string.Empty);
                    if (normalised != null && Enum.TryParse<T>(normalised, ignoreCase: true, out var parsed))
                    {
                        return parsed;
                    }
                    throw new JsonException($"'{text}' is not a valid {typeof(T).Name}.");
                default:
                    throw new JsonException($"Unexpected token {reader.TokenType} for {typeof(T).Name}.");
            }
        }

        public override void Write(Utf8JsonWriter writer, T value, JsonSerializerOptions options) =>
            writer.WriteNumberValue(Convert.ToInt32(value));
    }

    private sealed class NullableConverter<T> : JsonConverter<T?> where T : struct, Enum
    {
        private readonly Converter<T> _inner = new();

        public override T? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
            reader.TokenType == JsonTokenType.Null ? null : _inner.Read(ref reader, typeof(T), options);

        public override void Write(Utf8JsonWriter writer, T? value, JsonSerializerOptions options)
        {
            if (value.HasValue) _inner.Write(writer, value.Value, options);
            else writer.WriteNullValue();
        }
    }
}
