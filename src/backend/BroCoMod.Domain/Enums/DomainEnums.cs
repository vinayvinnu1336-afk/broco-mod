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
    Submitted = 1,
    NotifiedGarages = 2,
    QuotesReceived = 3,
    AdvisorAssigned = 4,
    CustomerQuotationSent = 5,
    CustomerAccepted = 6,
    CustomerRejected = 7,
    InProgress = 8,
    Completed = 9,
    Cancelled = 10
}

public enum QuoteStatus
{
    Draft = 1,
    Submitted = 2,
    UnderReview = 3,
    SelectedByAdvisor = 4,
    RejectedByAdvisor = 5,
    AcceptedByCustomer = 6,
    RejectedByCustomer = 7
}
