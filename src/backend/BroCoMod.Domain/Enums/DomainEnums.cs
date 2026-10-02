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
    Cancelled = 12
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

