using BroCoMod.Application.Common;
using BroCoMod.Domain.Entities.Identity;
using Microsoft.EntityFrameworkCore;

namespace BroCoMod.Infrastructure.Services;

/// <summary>
/// Finds accounts by Indian mobile number. Numbers are stored as "+91 98765 43210", but rows written before
/// that rule may hold "9876543210" or "+919876543210", so the database narrows by the last five digits and the
/// exact match is made on the parsed national number.
/// </summary>
internal static class MobileAccounts
{
    public static async Task<List<User>> FindByMobileAsync(
        this IQueryable<User> users,
        string nationalNumber,
        CancellationToken cancellationToken = default)
    {
        var tail = nationalNumber[5..];
        var candidates = await users
            .Where(u => u.PhoneNumber.EndsWith(tail))
            .ToListAsync(cancellationToken);
        return candidates.Where(u => IndianMobile.NationalNumber(u.PhoneNumber) == nationalNumber).ToList();
    }

    /// <summary>True when an active account other than <paramref name="exceptUserIds"/> already uses this mobile.</summary>
    public static async Task<bool> IsMobileTakenAsync(
        this IQueryable<User> users,
        string nationalNumber,
        IReadOnlyCollection<Guid>? exceptUserIds = null,
        CancellationToken cancellationToken = default)
    {
        var query = users.AsNoTracking().Where(u => u.IsActive);
        if (exceptUserIds is { Count: > 0 }) query = query.Where(u => !exceptUserIds.Contains(u.Id));
        return (await query.FindByMobileAsync(nationalNumber, cancellationToken)).Count > 0;
    }
}
