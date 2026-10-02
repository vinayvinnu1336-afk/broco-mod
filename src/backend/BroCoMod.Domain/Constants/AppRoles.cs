namespace BroCoMod.Domain.Constants;

public static class AppRoles
{
    public const string Customer = "CUSTOMER";
    public const string GarageOwner = "GARAGE_OWNER";
    public const string GarageManager = "GARAGE_MANAGER";
    public const string GarageStaff = "GARAGE_STAFF";
    public const string Advisor = "ADVISOR";
    public const string SuperAdmin = "SUPER_ADMIN";

    public static readonly IReadOnlyList<string> All = new[]
    {
        Customer,
        GarageOwner,
        GarageManager,
        GarageStaff,
        Advisor,
        SuperAdmin
    };

    public static bool IsGarageRole(string role) =>
        role is GarageOwner or GarageManager or GarageStaff;
}
