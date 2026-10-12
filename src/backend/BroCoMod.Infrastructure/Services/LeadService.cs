using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Entities;
using BroCoMod.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

public class LeadService : ILeadService
{
    private readonly IApplicationDbContext _context;

    public LeadService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<LeadDto> CreateAsync(CreateLeadRequest request, CancellationToken ct = default)
    {
        var digits = new string(request.MobileNumber.Where(char.IsDigit).ToArray());
        var mobile = "+91 " + digits[^10..];

        var vehicleSummary = string.Empty;
        if (request.VehicleModelId.HasValue)
        {
            vehicleSummary = await _context.VehicleModels.AsNoTracking()
                .Where(m => m.Id == request.VehicleModelId.Value)
                .Select(m => (m.Manufacturer != null ? m.Manufacturer.Name + " " : string.Empty) + m.Name)
                .FirstOrDefaultAsync(ct) ?? string.Empty;
        }

        // One open enquiry per number and car per day is enough for the call-back list.
        var since = DateTime.UtcNow.AddHours(-24);
        var duplicate = await _context.Leads.FirstOrDefaultAsync(l =>
            l.MobileNumber == mobile && l.VehicleModelId == request.VehicleModelId && l.CreatedAtUtc > since, ct);
        if (duplicate != null) return ToDto(duplicate);

        var lead = new Lead(mobile, request.City, request.VehicleModelId, vehicleSummary, request.FuelType, request.ServiceInterest);
        _context.Leads.Add(lead);
        await _context.SaveChangesAsync(ct);
        return ToDto(lead);
    }

    public async Task<PagedResult<LeadDto>> GetLeadsAsync(string? status, int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = _context.Leads.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<LeadStatus>(status, true, out var parsed))
            query = query.Where(l => l.Status == parsed);

        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(l => l.CreatedAtUtc)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync(ct);
        return new PagedResult<LeadDto>(items.Select(ToDto).ToList(), page, pageSize, total);
    }

    public async Task<LeadDto> UpdateAsync(Guid id, UpdateLeadRequest request, CancellationToken ct = default)
    {
        if (!Enum.TryParse<LeadStatus>(request.Status, true, out var status))
            throw new ArgumentException($"Unknown status '{request.Status}'.");
        var lead = await _context.Leads.FirstOrDefaultAsync(l => l.Id == id, ct)
            ?? throw new KeyNotFoundException("Enquiry not found.");
        lead.Update(status, request.Notes);
        await _context.SaveChangesAsync(ct);
        return ToDto(lead);
    }

    private static LeadDto ToDto(Lead l) => new(
        l.Id, l.MobileNumber, l.City, l.VehicleModelId, l.VehicleSummary, l.FuelType, l.ServiceInterest,
        l.Source, l.Status.ToString(), l.Notes, l.CreatedAtUtc);
}
