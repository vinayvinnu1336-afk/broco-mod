using BroCoMod.Domain.Common;
using BroCoMod.Domain.Entities.Identity;
using BroCoMod.Domain.Enums;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Immutable audit and business record of a customer's decision on a commercial quotation.
/// Binds to the exact snapshot version of the quotation approved and viewed by the customer.
/// </summary>
public class CustomerQuotationDecision : BaseEntity
{
    public Guid CustomerQuotationId { get; private set; }
    public Guid CustomerQuotationVersionId { get; private set; }
    public int VersionNumber { get; private set; }
    public Guid CustomerId { get; private set; }
    public CustomerDecisionType Decision { get; private set; }
    public string? DecisionCategory { get; private set; }
    public string? DecisionReason { get; private set; }
    public string? IdempotencyKey { get; private set; }
    public string? ClientIpAddress { get; private set; }
    public string? UserAgent { get; private set; }
    public DateTime DecidedAtUtc { get; private set; } = DateTime.UtcNow;

    // Navigation properties
    public CustomerQuotation? CustomerQuotation { get; private set; }
    public CustomerQuotationVersion? CustomerQuotationVersion { get; private set; }
    public User? Customer { get; private set; }

    protected CustomerQuotationDecision() { }

    public CustomerQuotationDecision(
        Guid customerQuotationId,
        Guid customerQuotationVersionId,
        int versionNumber,
        Guid customerId,
        CustomerDecisionType decision,
        string? decisionCategory = null,
        string? decisionReason = null,
        string? idempotencyKey = null,
        string? clientIpAddress = null,
        string? userAgent = null)
    {
        if (customerQuotationId == Guid.Empty)
            throw new ArgumentException("CustomerQuotationId cannot be empty.", nameof(customerQuotationId));
        if (customerQuotationVersionId == Guid.Empty)
            throw new ArgumentException("CustomerQuotationVersionId cannot be empty.", nameof(customerQuotationVersionId));
        if (customerId == Guid.Empty)
            throw new ArgumentException("CustomerId cannot be empty.", nameof(customerId));

        if (decision == CustomerDecisionType.Rejected && string.IsNullOrWhiteSpace(decisionReason))
        {
            throw new ArgumentException("Decision reason is mandatory when rejecting a quotation.", nameof(decisionReason));
        }

        CustomerQuotationId = customerQuotationId;
        CustomerQuotationVersionId = customerQuotationVersionId;
        VersionNumber = versionNumber;
        CustomerId = customerId;
        Decision = decision;
        DecisionCategory = decisionCategory?.Trim();
        DecisionReason = decisionReason?.Trim();
        IdempotencyKey = idempotencyKey?.Trim();
        ClientIpAddress = clientIpAddress?.Trim();
        UserAgent = userAgent?.Trim();
        DecidedAtUtc = DateTime.UtcNow;
    }
}
