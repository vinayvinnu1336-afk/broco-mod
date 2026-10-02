using BroCoMod.Application.DTOs;

namespace BroCoMod.Application.Interfaces;

public interface IAdvisorQuotationService
{
    Task<ApiResponse<QuoteComparisonDto>> GetQuoteComparisonAsync(Guid serviceRequestId, Guid requestingAdvisorId, CancellationToken ct = default);
    Task<ApiResponse<AdvisorRequestNoteDto>> AddInternalNoteAsync(Guid serviceRequestId, CreateAdvisorNoteRequest request, Guid advisorId, string advisorName, CancellationToken ct = default);
    Task<ApiResponse<List<AdvisorRequestNoteDto>>> GetInternalNotesAsync(Guid serviceRequestId, Guid requestingUserId, CancellationToken ct = default);
    Task<ApiResponse<AdvisorRequestNoteDto>> UpdateInternalNoteAsync(Guid noteId, UpdateAdvisorNoteRequest request, Guid requestingUserId, bool isAdmin, CancellationToken ct = default);
    Task<ApiResponse<bool>> DeleteInternalNoteAsync(Guid noteId, Guid requestingUserId, bool isAdmin, CancellationToken ct = default);
    Task<ApiResponse<GarageAssignmentDto>> AssignGarageAsync(Guid serviceRequestId, AssignGarageRequest request, Guid advisorId, string advisorName, CancellationToken ct = default);
    Task<ApiResponse<GarageAssignmentDto?>> GetActiveAssignmentAsync(Guid serviceRequestId, CancellationToken ct = default);
    Task<ApiResponse<List<GarageAssignmentDto>>> GetAllAssignmentsAsync(int page = 1, int pageSize = 50, CancellationToken ct = default);
}
