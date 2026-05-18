using Amazon.S3;
using Amazon.S3.Transfer;
using DeliveryApp.API.Data;
using DeliveryApp.API.Models;
using Microsoft.EntityFrameworkCore;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace DeliveryApp.API.Services;

public class PhotoService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly AuditService _audit;
    private readonly IWebHostEnvironment _env;
    private static readonly string[] AllowedTypes = ["image/jpeg", "image/png", "image/heic"];

    public PhotoService(AppDbContext db, IConfiguration config, AuditService audit, IWebHostEnvironment env)
    {
        _db = db;
        _config = config;
        _audit = audit;
        _env = env;
    }

    public async Task<OrderPhoto?> UploadPhotoAsync(Guid orderId, IFormFile file, string? caption, Guid callerId)
    {
        var order = await _db.Orders
            .Include(o => o.Photos)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null || order.ShipperId != callerId) return null;
        if (order.LockedAt.HasValue && order.LockedAt < DateTime.UtcNow) return null;
        if (order.Photos.Count >= 5) return null;
        if (!AllowedTypes.Contains(file.ContentType.ToLower())) return null;
        if (file.Length > 10 * 1024 * 1024) return null;

        var compressed = await CompressAsync(file);
        var url = await UploadToR2Async(compressed, $"{orderId}/{Guid.NewGuid()}.jpg");

        var photo = new OrderPhoto
        {
            OrderId = orderId,
            Url = url,
            Caption = caption
        };
        _db.OrderPhotos.Add(photo);

        _audit.Add("NOTE_PHOTO", "Order", orderId, newValue: caption,
            description: $"{order.OrderCode}: thêm ảnh{(caption != null ? $" — {caption}" : "")}");

        await _db.SaveChangesAsync();
        return photo;
    }

    public async Task<bool> DeletePhotoAsync(Guid orderId, Guid photoId, Guid callerId)
    {
        var photo = await _db.OrderPhotos
            .Include(p => p.Order)
            .FirstOrDefaultAsync(p => p.Id == photoId && p.OrderId == orderId);

        if (photo == null || photo.Order.ShipperId != callerId) return false;
        if (photo.Order.LockedAt.HasValue && photo.Order.LockedAt < DateTime.UtcNow) return false;

        _db.OrderPhotos.Remove(photo);
        _audit.Add("NOTE_PHOTO", "Order", orderId, oldValue: photo.Caption,
            description: $"{photo.Order.OrderCode}: xoá ảnh");
        await _db.SaveChangesAsync();
        return true;
    }

    private async Task<Stream> CompressAsync(IFormFile file)
    {
        try
        {
            using var input = file.OpenReadStream();
            using var img = await Image.LoadAsync(input);
            if (img.Width > 1920 || img.Height > 1920)
                img.Mutate(x => x.Resize(new ResizeOptions { Mode = ResizeMode.Max, Size = new Size(1920, 1920) }));

            var ms = new MemoryStream();
            await img.SaveAsJpegAsync(ms, new JpegEncoder { Quality = 80 });
            ms.Position = 0;
            return ms;
        }
        catch
        {
            var fallback = new MemoryStream();
            await using var raw = file.OpenReadStream();
            await raw.CopyToAsync(fallback);
            fallback.Position = 0;
            return fallback;
        }
    }

    private async Task<string> UploadToR2Async(Stream stream, string key)
    {
        var bucketName = _config["R2:BucketName"];
        var endpoint = _config["R2:Endpoint"];

        if (string.IsNullOrEmpty(bucketName) || string.IsNullOrEmpty(endpoint))
            return await SaveLocalAsync(stream, key);

        var s3Config = new AmazonS3Config
        {
            ServiceURL = endpoint,
            ForcePathStyle = true
        };

        using var client = new AmazonS3Client(
            _config["R2:AccessKey"],
            _config["R2:SecretKey"],
            s3Config);

        var transfer = new TransferUtility(client);
        await transfer.UploadAsync(stream, bucketName, key);

        var publicUrl = _config["R2:PublicUrl"];
        var baseUrl = !string.IsNullOrEmpty(publicUrl) ? publicUrl : $"{endpoint}/{bucketName}";
        return $"{baseUrl}/{key}";
    }

    private async Task<string> SaveLocalAsync(Stream stream, string key)
    {
        var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
        var fullPath = Path.Combine(webRoot, "uploads", "photos", key.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        stream.Position = 0;
        await using var fs = File.Create(fullPath);
        await stream.CopyToAsync(fs);
        return $"/uploads/photos/{key}";
    }
}
