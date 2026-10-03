namespace BroCoMod.Domain.Constants;

public static class AppPermissions
{
    // Customer Permissions
    public const string CustomerRequestCreate = "CUSTOMER_REQUEST_CREATE";
    public const string CustomerRequestView = "CUSTOMER_REQUEST_VIEW";
    public const string CustomerQuoteView = "CUSTOMER_QUOTE_VIEW";
    public const string CustomerQuoteRespond = "CUSTOMER_QUOTE_RESPOND";
    public const string CustomerProfileManage = "CUSTOMER_PROFILE_MANAGE";

    // Garage Permissions
    public const string GarageRequestView = "GARAGE_REQUEST_VIEW";
    public const string GarageRequestAccept = "GARAGE_REQUEST_ACCEPT";
    public const string GarageRequestDecline = "GARAGE_REQUEST_DECLINE";
    public const string GarageQuoteCreate = "GARAGE_QUOTE_CREATE";
    public const string GarageQuoteUpdate = "GARAGE_QUOTE_UPDATE";
    public const string GarageProfileManage = "GARAGE_PROFILE_MANAGE";
    public const string GarageUsersManage = "GARAGE_USERS_MANAGE";

    // Advisor Permissions
    public const string AdvisorRequestView = "ADVISOR_REQUEST_VIEW";
    public const string AdvisorQuoteView = "ADVISOR_QUOTE_VIEW";
    public const string AdvisorQuoteReview = "ADVISOR_QUOTE_REVIEW";
    public const string AdvisorCustomerQuoteCreate = "ADVISOR_CUSTOMER_QUOTE_CREATE";
    public const string AdvisorGarageAssign = "ADVISOR_GARAGE_ASSIGN";
    public const string AdvisorRequestReassign = "ADVISOR_REQUEST_REASSIGN";
    public const string AdvisorProfileManage = "ADVISOR_PROFILE_MANAGE";
    public const string AdvisorWorkQueueView = "ADVISOR_WORKQUEUE_VIEW";

    // Admin Permissions
    public const string AdminUsersManage = "ADMIN_USERS_MANAGE";
    public const string AdminGaragesManage = "ADMIN_GARAGES_MANAGE";
    public const string AdminGaragesView = "ADMIN_GARAGES_VIEW";
    public const string AdminAdvisorsManage = "ADMIN_ADVISORS_MANAGE";
    public const string AdminAdvisorsView = "ADMIN_ADVISORS_VIEW";
    public const string AdminRequestsManage = "ADMIN_REQUESTS_MANAGE";
    public const string AdminRequestsView = "ADMIN_REQUESTS_VIEW";
    public const string AdminSettingsManage = "ADMIN_SETTINGS_MANAGE";
    public const string AdminAuditView = "ADMIN_AUDIT_VIEW";
    public const string AdminDashboardView = "ADMIN_DASHBOARD_VIEW";
    public const string AdminCustomersView = "ADMIN_CUSTOMERS_VIEW";
    public const string AdminJobsView = "ADMIN_JOBS_VIEW";
    public const string AdminNotificationsView = "ADMIN_NOTIFICATIONS_VIEW";
    public const string AdminNotificationsManage = "ADMIN_NOTIFICATIONS_MANAGE";
    public const string AdminSystemHealthView = "ADMIN_SYSTEMHEALTH_VIEW";

    // Financial Permissions
    public const string CustomerPaymentView = "CUSTOMER_PAYMENT_VIEW";
    public const string CustomerPaymentCreate = "CUSTOMER_PAYMENT_CREATE";
    public const string CustomerInvoiceView = "CUSTOMER_INVOICE_VIEW";
    public const string GarageFinanceView = "GARAGE_FINANCE_VIEW";
    public const string AdminFinanceView = "ADMIN_FINANCE_VIEW";
    public const string AdminPaymentsManage = "ADMIN_PAYMENTS_MANAGE";
    public const string AdminSettlementsManage = "ADMIN_SETTLEMENTS_MANAGE";
    public const string AdminRefundsManage = "ADMIN_REFUNDS_MANAGE";

    public static readonly IReadOnlyList<string> All = new[]
    {
        CustomerRequestCreate, CustomerRequestView, CustomerQuoteView, CustomerQuoteRespond, CustomerProfileManage,
        GarageRequestView, GarageRequestAccept, GarageRequestDecline, GarageQuoteCreate, GarageQuoteUpdate, GarageProfileManage, GarageUsersManage,
        AdvisorRequestView, AdvisorQuoteView, AdvisorQuoteReview, AdvisorCustomerQuoteCreate, AdvisorGarageAssign, AdvisorRequestReassign, AdvisorProfileManage, AdvisorWorkQueueView,
        AdminUsersManage, AdminGaragesManage, AdminGaragesView, AdminAdvisorsManage, AdminAdvisorsView, AdminRequestsManage, AdminRequestsView,
        AdminSettingsManage, AdminAuditView, AdminDashboardView, AdminCustomersView, AdminJobsView, AdminNotificationsView, AdminNotificationsManage, AdminSystemHealthView,
        CustomerPaymentView, CustomerPaymentCreate, CustomerInvoiceView, GarageFinanceView, AdminFinanceView, AdminPaymentsManage, AdminSettlementsManage, AdminRefundsManage
    };

    public static IReadOnlyList<string> GetDefaultPermissionsForRole(string role)
    {
        return role switch
        {
            AppRoles.Customer => new[]
            {
                CustomerRequestCreate,
                CustomerRequestView,
                CustomerQuoteView,
                CustomerQuoteRespond,
                CustomerProfileManage,
                CustomerPaymentView,
                CustomerPaymentCreate,
                CustomerInvoiceView
            },
            AppRoles.GarageOwner => new[]
            {
                GarageRequestView,
                GarageRequestAccept,
                GarageRequestDecline,
                GarageQuoteCreate,
                GarageQuoteUpdate,
                GarageProfileManage,
                GarageUsersManage,
                GarageFinanceView
            },
            AppRoles.GarageManager => new[]
            {
                GarageRequestView,
                GarageRequestAccept,
                GarageRequestDecline,
                GarageQuoteCreate,
                GarageQuoteUpdate,
                GarageProfileManage,
                GarageFinanceView
            },
            AppRoles.GarageStaff => new[]
            {
                GarageRequestView,
                GarageQuoteCreate
            },
            AppRoles.Advisor => new[]
            {
                AdvisorRequestView,
                AdvisorQuoteView,
                AdvisorQuoteReview,
                AdvisorCustomerQuoteCreate,
                AdvisorGarageAssign,
                AdvisorRequestReassign,
                AdvisorProfileManage,
                AdvisorWorkQueueView,
                AdminFinanceView
            },
            AppRoles.SuperAdmin => All,
            _ => Array.Empty<string>()
        };
    }
}
