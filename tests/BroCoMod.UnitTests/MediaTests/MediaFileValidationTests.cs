using System.Text;
using BroCoMod.Domain.Entities;
using BroCoMod.Infrastructure.Services.Media;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace BroCoMod.UnitTests.MediaTests;

public class MediaFileValidationTests
{
    private const long MaxPhoto = 10 * 1024 * 1024;
    private const long MaxVideo = 100 * 1024 * 1024;

    private static readonly byte[] Jpeg = { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01 };
    private static readonly byte[] Png = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52 };
    private static readonly byte[] Webp = Encoding.ASCII.GetBytes("RIFF\x24\0\0\0WEBPVP8 ");
    private static readonly byte[] Heic = Box("ftypheic");
    private static readonly byte[] Mp4 = Box("ftypisom");
    private static readonly byte[] QuickTime = Box("ftypqt  ");
    private static readonly byte[] Webm = { 0x1A, 0x45, 0xDF, 0xA3, 0x9F, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84, (byte)'w', (byte)'e', (byte)'b', (byte)'m' };

    /// <summary>An ISO-BMFF header: 4-byte box size, then the given type and brand.</summary>
    private static byte[] Box(string typeAndBrand) =>
        new byte[] { 0x00, 0x00, 0x00, 0x18 }.Concat(Encoding.ASCII.GetBytes(typeAndBrand)).Concat(new byte[] { 0, 0, 0, 0 }).ToArray();

    public static IEnumerable<object[]> AllowedFiles => new[]
    {
        new object[] { Jpeg, "front.jpg", "image/jpeg", ServiceMediaKind.Photo, "image/jpeg" },
        new object[] { Jpeg, "FRONT.JPEG", "image/jpeg", ServiceMediaKind.Photo, "image/jpeg" },
        new object[] { Png, "scratch.png", "image/png", ServiceMediaKind.Photo, "image/png" },
        new object[] { Webp, "dent.webp", "image/webp", ServiceMediaKind.Photo, "image/webp" },
        new object[] { Heic, "IMG_0001.HEIC", "", ServiceMediaKind.Photo, "image/heic" },
        new object[] { Heic, "IMG_0002.heic", "image/heif", ServiceMediaKind.Photo, "image/heic" },
        new object[] { Mp4, "engine.mp4", "video/mp4", ServiceMediaKind.Video, "video/mp4" },
        new object[] { QuickTime, "IMG_0003.MOV", "video/quicktime", ServiceMediaKind.Video, "video/quicktime" },
        new object[] { Mp4, "clip.mov", "application/octet-stream", ServiceMediaKind.Video, "video/mp4" },
        new object[] { Webm, "noise.webm", "video/webm", ServiceMediaKind.Video, "video/webm" },
    };

    [Theory]
    [MemberData(nameof(AllowedFiles))]
    public void AllowedPhotosAndVideos_AreRecognisedFromTheirBytes(byte[] header, string name, string declared, ServiceMediaKind kind, string contentType)
    {
        var (type, error) = MediaFileInspector.Validate(header, name, declared, 2048, MaxPhoto, MaxVideo);

        error.Should().BeNull();
        type!.Kind.Should().Be(kind);
        type.ContentType.Should().Be(contentType);
    }

    [Fact]
    public void ARenamedFile_IsRejected_BecauseItsBytesAreNotTheClaimedType()
    {
        var html = Encoding.ASCII.GetBytes("<html><script>alert(1)</script></html>");

        var (type, error) = MediaFileInspector.Validate(html, "photo.jpg", "image/jpeg", html.Length, MaxPhoto, MaxVideo);

        type.Should().BeNull();
        error.Should().Contain("not a real JPG file");
    }

    [Fact]
    public void APngNamedJpg_IsRejected()
    {
        var (type, error) = MediaFileInspector.Validate(Png, "photo.jpg", "image/jpeg", 100, MaxPhoto, MaxVideo);

        type.Should().BeNull();
        error.Should().Contain("not a real JPG");
    }

    [Fact]
    public void ADeclaredTypeThatDisagreesWithTheBytes_IsRejected()
    {
        var (type, error) = MediaFileInspector.Validate(Jpeg, "photo.jpg", "text/html", 100, MaxPhoto, MaxVideo);

        type.Should().BeNull();
        error.Should().Contain("says it is text/html");
    }

    [Theory]
    [InlineData("doc.pdf")]
    [InlineData("anim.gif")]
    [InlineData("vector.svg")]
    [InlineData("noextension")]
    public void OtherFileTypes_AreRejected_WithTheListOfAllowedTypes(string name)
    {
        var (type, error) = MediaFileInspector.Validate(Jpeg, name, null, 100, MaxPhoto, MaxVideo);

        type.Should().BeNull();
        error.Should().Contain("not a supported photo or video").And.Contain("Videos: mp4, mov, webm");
    }

    [Fact]
    public void PhotosOver10Mb_AndVideosOver100Mb_AreRejected_ButExactlyTheLimitIsFine()
    {
        MediaFileInspector.Validate(Jpeg, "a.jpg", "image/jpeg", MaxPhoto, MaxPhoto, MaxVideo).Error.Should().BeNull();
        MediaFileInspector.Validate(Jpeg, "a.jpg", "image/jpeg", MaxPhoto + 1, MaxPhoto, MaxVideo).Error
            .Should().Contain("Photos can be up to 10 MB");

        MediaFileInspector.Validate(Mp4, "a.mp4", "video/mp4", MaxVideo, MaxPhoto, MaxVideo).Error.Should().BeNull();
        MediaFileInspector.Validate(Mp4, "a.mp4", "video/mp4", MaxVideo + 1, MaxPhoto, MaxVideo).Error
            .Should().Contain("Videos can be up to 100 MB");
    }

    [Fact]
    public void EmptyFiles_AndTruncatedHeaders_AreRejected()
    {
        MediaFileInspector.Validate(Jpeg, "a.jpg", "image/jpeg", 0, MaxPhoto, MaxVideo).Error.Should().Contain("empty");
        MediaFileInspector.Detect(new byte[] { 0xFF, 0xD8 }).Should().BeNull();
        MediaFileInspector.Detect(Array.Empty<byte>()).Should().BeNull();
    }

    [Fact]
    public void AvifAndMatroskaThatIsNotWebm_AreNotAccepted()
    {
        MediaFileInspector.Detect(Box("ftypavif")).Should().BeNull();
        var mkv = new byte[] { 0x1A, 0x45, 0xDF, 0xA3, 0x9F, 0x42, 0x86, 0x81, 0x01, (byte)'m', (byte)'a', (byte)'t', (byte)'r', (byte)'o', (byte)'s', (byte)'k', (byte)'a' };
        MediaFileInspector.Detect(mkv).Should().BeNull();
    }

    [Fact]
    public void Thumbnails_MustBeJpegPngOrWebp()
    {
        MediaFileInspector.DetectThumbnail(Jpeg)!.Extension.Should().Be(".jpg");
        MediaFileInspector.DetectThumbnail(Webp)!.Extension.Should().Be(".webp");
        MediaFileInspector.DetectThumbnail(Heic).Should().BeNull();
        MediaFileInspector.DetectThumbnail(Mp4).Should().BeNull();
    }
}

public class MediaUrlSignerTests
{
    private static MediaUrlSigner CreateSigner(int lifetimeMinutes = 60) =>
        new(Options.Create(new MediaOptions { UrlLifetimeMinutes = lifetimeMinutes }),
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "unit-test-secret-that-is-long-enough-for-hmac-signing"
            }).Build());

    [Fact]
    public void ASignedLink_IsValidForItsMediaAndAudience_Only()
    {
        var signer = CreateSigner();
        var id = Guid.NewGuid();
        var exp = signer.NextExpiry().ToUnixTimeSeconds();
        var sig = signer.Sign(id, exp, MediaUrlSigner.StaffAudience);

        signer.IsValid(id, exp, MediaUrlSigner.StaffAudience, sig).Should().BeTrue();
        signer.IsValid(Guid.NewGuid(), exp, MediaUrlSigner.StaffAudience, sig).Should().BeFalse("bound to the media id");
        signer.IsValid(id, exp, MediaUrlSigner.CustomerAudience, sig).Should().BeFalse("bound to the audience");
        signer.IsValid(id, exp + 900, MediaUrlSigner.StaffAudience, sig).Should().BeFalse("bound to the expiry");
        signer.IsValid(id, exp, MediaUrlSigner.StaffAudience, sig[..^2] + "AA").Should().BeFalse();
        signer.IsValid(id, exp, MediaUrlSigner.StaffAudience, "not base64 !!").Should().BeFalse();
        signer.IsValid(id, exp, MediaUrlSigner.StaffAudience, null).Should().BeFalse();
    }

    [Fact]
    public void ExpiredLinks_AndLinksClaimingAFarFutureExpiry_AreRejected()
    {
        var signer = CreateSigner();
        var id = Guid.NewGuid();
        var past = DateTimeOffset.UtcNow.AddMinutes(-1).ToUnixTimeSeconds();
        signer.IsValid(id, past, "s", signer.Sign(id, past, "s")).Should().BeFalse();

        var farFuture = DateTimeOffset.UtcNow.AddDays(30).ToUnixTimeSeconds();
        signer.IsValid(id, farFuture, "s", signer.Sign(id, farFuture, "s")).Should().BeFalse();
    }

    [Fact]
    public void Expiry_IsRoundedUpTo15Minutes_SoRepeatedListsReuseTheSameUrl()
    {
        var signer = CreateSigner(60);
        var now = new DateTimeOffset(2026, 10, 14, 10, 7, 30, TimeSpan.Zero);

        signer.NextExpiry(now).Should().Be(new DateTimeOffset(2026, 10, 14, 11, 15, 0, TimeSpan.Zero));
        signer.NextExpiry(now.AddMinutes(5)).Should().Be(signer.NextExpiry(now));
    }
}
