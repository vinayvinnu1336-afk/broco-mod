using BroCoMod.Application.DTOs;

namespace BroCoMod.Application.Interfaces;

/// <summary>
/// The one place bookings are cancelled. Customers may cancel their own request only until any
/// payment is made; after that only a super admin can, and refunds stay a separate admin step.
/// Garages, garage staff and advisors never cancel: a garage asks BroCo instead.
/// </summary>
public interface IBookingCancellationService
{
    /// <exception cref="Common.CancellationNotAllowedException">Something was paid, or the car is already at the garage.</exception>
    Task CancelByCustomerAsync(Guid customerIdOrUserId, Guid requestId, string reason, CancellationToken cancellationToken = default);

    Task<AdminBookingCancellationDto> GetAdminCancellationAsync(Guid requestId, CancellationToken cancellationToken = default);

    Task<AdminBookingCancellationDto> CancelByAdminAsync(Guid requestId, Guid adminUserId, string reason, CancellationToken cancellationToken = default);

    /// <summary>The garage can't do the job: tell the admins and the request's advisor, without cancelling anything.</summary>
    Task<GarageCancellationAskResultDto> AskBroCoToCancelAsync(Guid jobId, Guid garageId, Guid userId, string reason, CancellationToken cancellationToken = default);
}
