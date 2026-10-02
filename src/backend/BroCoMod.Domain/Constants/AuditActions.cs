namespace BroCoMod.Domain.Constants;

public static class AuditActions
{
    // Authentication & Identity
    public const string Login = "LOGIN";
    public const string LoginFailed = "LOGIN_FAILED";
    public const string Logout = "LOGOUT";
    public const string UserCreated = "USER_CREATED";
    public const string UserUpdated = "USER_UPDATED";
    public const string RoleChanged = "ROLE_CHANGED";
    public const string AccountSuspended = "ACCOUNT_SUSPENDED";
    public const string AccountActivated = "ACCOUNT_ACTIVATED";
    public const string PasswordResetRequested = "PASSWORD_RESET_REQUESTED";
    public const string PasswordResetCompleted = "PASSWORD_RESET_COMPLETED";
    public const string RefreshTokenRevoked = "REFRESH_TOKEN_REVOKED";

    // Future workflow events prepared
    public const string QuoteCreated = "QUOTE_CREATED";
    public const string QuoteUpdated = "QUOTE_UPDATED";
    public const string GarageAssigned = "GARAGE_ASSIGNED";
    public const string CustomerQuoteSent = "CUSTOMER_QUOTE_SENT";
    public const string CustomerQuoteAccepted = "CUSTOMER_QUOTE_ACCEPTED";
    public const string CustomerQuoteRejected = "CUSTOMER_QUOTE_REJECTED";
}
