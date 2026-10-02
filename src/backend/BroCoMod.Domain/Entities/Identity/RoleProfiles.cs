using BroCoMod.Domain.Common;

namespace BroCoMod.Domain.Entities.Identity;

public class CustomerProfile : BaseEntity
{
    public Guid UserId { get; private set; }
    public string Address { get; private set; } = string.Empty;
    public string PreferredContactMethod { get; private set; } = "Email";

    public User User { get; private set; } = default!;

    protected CustomerProfile() { }

    public CustomerProfile(Guid userId, string address = "", string preferredContactMethod = "Email")
    {
        UserId = userId;
        Address = address;
        PreferredContactMethod = preferredContactMethod;
    }

    public void UpdateProfile(string address, string preferredContactMethod)
    {
        Address = address;
        PreferredContactMethod = preferredContactMethod;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

public class GarageUser : BaseEntity
{
    public Guid UserId { get; private set; }
    public Guid GarageId { get; private set; }
    public string RoleName { get; private set; } = "GARAGE_STAFF"; // GARAGE_OWNER, GARAGE_MANAGER, GARAGE_STAFF
    public string Title { get; private set; } = string.Empty;

    public User User { get; private set; } = default!;
    public Garage Garage { get; private set; } = default!;

    protected GarageUser() { }

    public GarageUser(Guid userId, Guid garageId, string roleName, string title = "")
    {
        UserId = userId;
        GarageId = garageId;
        RoleName = roleName;
        Title = title;
    }

    public void UpdateRole(string newRoleName, string newTitle)
    {
        RoleName = newRoleName;
        Title = newTitle;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

public class AdvisorProfile : BaseEntity
{
    public Guid UserId { get; private set; }
    public string EmployeeCode { get; private set; } = string.Empty;
    public string Specialization { get; private set; } = string.Empty;
    public int MaxAssignedRequests { get; private set; } = 25;

    public User User { get; private set; } = default!;

    protected AdvisorProfile() { }

    public AdvisorProfile(Guid userId, string employeeCode, string specialization = "General Automotive", int maxAssignedRequests = 25)
    {
        UserId = userId;
        EmployeeCode = employeeCode;
        Specialization = specialization;
        MaxAssignedRequests = maxAssignedRequests;
    }

    public void UpdateDetails(string specialization, int maxAssignedRequests)
    {
        Specialization = specialization;
        MaxAssignedRequests = maxAssignedRequests;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
