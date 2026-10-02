using BroCoMod.Domain.Common;

namespace BroCoMod.Domain.Entities;

/// <summary>
/// Confidential internal technical/operational note recorded by an Advisor for a ServiceRequest.
/// STRICT SECURITY: Notes are internal to BroCo Mod and must NEVER be exposed to Customers or Garages.
/// </summary>
public class AdvisorRequestNote : BaseEntity
{
    public Guid ServiceRequestId { get; private set; }
    public Guid AdvisorId { get; private set; }
    public string AdvisorName { get; private set; } = string.Empty;
    public string Note { get; private set; } = string.Empty;
    public bool IsInternal { get; private set; } = true;

    // Navigation property
    public ServiceRequest? ServiceRequest { get; private set; }

    protected AdvisorRequestNote() { }

    public AdvisorRequestNote(Guid serviceRequestId, Guid advisorId, string advisorName, string note)
    {
        if (serviceRequestId == Guid.Empty)
            throw new ArgumentException("ServiceRequestId cannot be empty.", nameof(serviceRequestId));
        if (advisorId == Guid.Empty)
            throw new ArgumentException("AdvisorId cannot be empty.", nameof(advisorId));
        if (string.IsNullOrWhiteSpace(note))
            throw new ArgumentException("Note cannot be empty.", nameof(note));

        ServiceRequestId = serviceRequestId;
        AdvisorId = advisorId;
        AdvisorName = string.IsNullOrWhiteSpace(advisorName) ? "Advisor" : advisorName.Trim();
        Note = note.Trim();
        IsInternal = true;
    }

    public void Update(string newNote, Guid requestingAdvisorId, bool isAdmin = false)
    {
        if (!isAdmin && requestingAdvisorId != AdvisorId)
            throw new UnauthorizedAccessException("Only the authoring advisor can edit this internal note.");

        if (string.IsNullOrWhiteSpace(newNote))
            throw new ArgumentException("Note cannot be empty.", nameof(newNote));

        Note = newNote.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
