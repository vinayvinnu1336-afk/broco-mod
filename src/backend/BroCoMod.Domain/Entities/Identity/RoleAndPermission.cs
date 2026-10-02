using BroCoMod.Domain.Common;

namespace BroCoMod.Domain.Entities.Identity;

public class Role : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public string NormalizedName { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;

    public ICollection<UserRole> UserRoles { get; private set; } = new List<UserRole>();
    public ICollection<RolePermission> RolePermissions { get; private set; } = new List<RolePermission>();

    protected Role() { }

    public Role(string name, string description = "")
    {
        Name = name.Trim().ToUpperInvariant();
        NormalizedName = Name;
        Description = description;
    }
}

public class Permission : BaseEntity
{
    public string Code { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string Category { get; private set; } = string.Empty;

    public ICollection<RolePermission> RolePermissions { get; private set; } = new List<RolePermission>();

    protected Permission() { }

    public Permission(string code, string description = "", string category = "General")
    {
        Code = code.Trim().ToUpperInvariant();
        Description = description;
        Category = category;
    }
}

public class UserRole
{
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;

    public Guid RoleId { get; set; }
    public Role Role { get; set; } = default!;
}

public class RolePermission
{
    public Guid RoleId { get; set; }
    public Role Role { get; set; } = default!;

    public Guid PermissionId { get; set; }
    public Permission Permission { get; set; } = default!;
}
