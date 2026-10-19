namespace BroCoMod.Application.DTOs;

// ==========================================
// Advisor accounts created by an administrator
// ==========================================

/// <summary>
/// A new advisor account. When <see cref="Password"/> is empty a temporary password is generated and returned once.
/// </summary>
public record CreateAdvisorRequest(
    string FullName,
    string MobileNumber,
    string Email,
    string? Specialization = null,
    int? MaxAssignedRequests = null,
    string? Password = null
);

/// <summary>Turns an existing customer account (found by email or mobile) into an advisor.</summary>
public record PromoteToAdvisorRequest(
    string? Email = null,
    string? MobileNumber = null,
    string? Specialization = null,
    int? MaxAssignedRequests = null
);

public record UpdateAdvisorRequest(
    string? FullName = null,
    string? Specialization = null,
    int? MaxAssignedRequests = null
);

/// <summary>
/// The result of creating an advisor. <see cref="TemporaryPassword"/> is only set when the password was generated,
/// and only in this response: it is never stored in plain text or shown again.
/// </summary>
public record CreatedAdvisorDto(
    AdminAdvisorListDto Advisor,
    string LoginMobile,
    string? TemporaryPassword,
    bool PasswordGenerated,
    bool WelcomeEmailSent,
    string WelcomeEmailStatus
);

public record PromotedAdvisorDto(
    AdminAdvisorListDto Advisor,
    bool AlreadyAdvisor
);

/// <summary>Sent with <see cref="AdvisorAccountErrors.ExistingCustomer"/> so the admin can promote that account instead.</summary>
public record ExistingCustomerAccountDto(
    Guid UserId,
    string FullName,
    string Email,
    string PhoneNumber,
    string MatchedBy
);

/// <summary>Error codes the admin UI acts on. Sent as the first entry of <c>ApiResponse.Errors</c>.</summary>
public static class AdvisorAccountErrors
{
    public const string Validation = "VALIDATION";
    public const string EmailTaken = "EMAIL_TAKEN";
    public const string MobileTaken = "MOBILE_TAKEN";
    public const string ExistingCustomer = "EXISTING_CUSTOMER_ACCOUNT";
    public const string AlreadyAdvisor = "ALREADY_ADVISOR";
    public const string NotEligible = "NOT_ELIGIBLE";
    public const string NotFound = "NOT_FOUND";
}

public sealed class AdvisorAccountException : Exception
{
    public string Code { get; }
    public int StatusCode { get; }
    public ExistingCustomerAccountDto? ExistingCustomer { get; }

    public AdvisorAccountException(string code, string message, int statusCode = 400, ExistingCustomerAccountDto? existingCustomer = null)
        : base(message)
    {
        Code = code;
        StatusCode = statusCode;
        ExistingCustomer = existingCustomer;
    }
}
