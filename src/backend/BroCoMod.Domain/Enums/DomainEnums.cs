namespace BroCoMod.Domain.Enums;

public enum UserRole
{
    Customer = 1,
    Garage = 2,
    GarageOwner = 3,
    GarageManager = 4,
    GarageStaff = 5,
    Advisor = 6,
    SuperAdmin = 7
}

public enum ServiceRequestStatus
{
    New = 1,
    Submitted = 1, // Backward compatibility alias with Milestone 1
    AssignedToAdvisor = 2,
    UnderReview = 3,
    GarageMatching = 4,
    GaragesNotified = 5,
    QuotesReceived = 6,
    CustomerQuotationSent = 7,
    CustomerAccepted = 8,
    CustomerRejected = 9,
    InProgress = 10,
    Completed = 11,
    Cancelled = 12,
    AdvisorReview = 13,
    GarageSelected = 14,
    BookingConfirmed = 15
}

public enum GarageRequestStatus
{
    Pending = 1,
    Notified = 2,
    Viewed = 3,
    Accepted = 4,
    Declined = 5,
    Expired = 6
}

public enum NotificationChannel
{
    InApp = 1,
    Email = 2,
    Sms = 3,
    WhatsApp = 4
}

public enum QuoteStatus
{
    Draft = 1,
    Submitted = 2,
    UnderReview = 3,
    SelectedByAdvisor = 4,
    RejectedByAdvisor = 5,
    AcceptedByCustomer = 6,
    RejectedByCustomer = 7,
    Expired = 8,
    Withdrawn = 9
}

public enum QuoteLineType
{
    Labour = 1,
    Part = 2,
    Service = 3,
    Other = 4
}

public enum GarageAssignmentStatus
{
    Assigned = 1,
    Cancelled = 2,
    Reassigned = 3,
    Confirmed = 4
}

public enum CustomerQuotationStatus
{
    Draft = 1,
    ReadyToSend = 2,
    Sent = 3,
    Accepted = 4,
    Rejected = 5,
    Expired = 6,
    Cancelled = 7
}

public enum CustomerDecisionType
{
    Accepted = 1,
    Rejected = 2
}

public enum RejectionCategory
{
    PriceTooHigh = 1,
    TimingNotSuitable = 2,
    ServiceNotRequired = 3,
    ChangedMind = 4,
    AlternativeFound = 5,
    Other = 6
}

public enum ServiceJobStatus
{
    BookingConfirmed = 1,
    Scheduled = 2,
    VehicleReceived = 3,
    Inspection = 4,
    WorkStarted = 5,
    WorkInProgress = 6,
    WorkCompleted = 7,
    VehicleReady = 8,
    HandedOver = 9,
    Closed = 10,
    Cancelled = 11
}

public enum InspectionSeverity
{
    Info = 1,
    Low = 2,
    Medium = 3,
    High = 4,
    Critical = 5
}

public enum AdditionalWorkStatus
{
    PendingAdvisorReview = 1,
    Approved = 2,
    Rejected = 3,
    Cancelled = 4
}

public enum JobActivityType
{
    JobCreated = 1,
    JobScheduled = 2,
    VehicleReceived = 3,
    InspectionStarted = 4,
    InspectionCompleted = 5,
    WorkStarted = 6,
    WorkProgressUpdated = 7,
    WorkCompleted = 8,
    VehicleReady = 9,
    VehicleHandedOver = 10,
    JobClosed = 11,
    JobCancelled = 12,
    AdditionalWorkRequested = 13,
    AdditionalWorkReviewed = 14
}

public enum GarageStatus
{
    PendingVerification = 1,
    Verified = 2,
    Suspended = 3,
    Inactive = 4
}

public enum NotificationStatus
{
    Pending = 1,
    Processing = 2,
    Sent = 3,
    Failed = 4,
    Cancelled = 5
}

public enum PaymentStatus
{
    Created = 1,
    Pending = 2,
    Processing = 3,
    Paid = 4,
    Failed = 5,
    Cancelled = 6,
    RefundPending = 7,
    PartiallyRefunded = 8,
    Refunded = 9
}

public enum PaymentPurpose
{
    ServiceQuotation = 1,
    AdditionalWork = 2,
    Refund = 3,
    Other = 4
}

public enum PaymentMethod
{
    Card = 1,
    NetBanking = 2,
    Upi = 3,
    Wallet = 4,
    BankTransfer = 5,
    TestProvider = 6
}

public enum InvoiceStatus
{
    Draft = 1,
    Issued = 2,
    Paid = 3,
    Void = 4,
    Refunded = 5
}

public enum SettlementStatus
{
    Pending = 1,
    Processing = 2,
    Completed = 3,
    OnHold = 4,
    Cancelled = 5
}

public enum LedgerEntryType
{
    CustomerPayment = 1,
    PlatformFee = 2,
    GaragePayable = 3,
    Refund = 4,
    Adjustment = 5
}

public enum PlatformFeeType
{
    Percentage = 1,
    Fixed = 2,
    PercentageAndFixed = 3
}



