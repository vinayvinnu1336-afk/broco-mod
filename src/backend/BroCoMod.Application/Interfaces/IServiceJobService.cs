using BroCoMod.Application.DTOs;

namespace BroCoMod.Application.Interfaces;

public interface IServiceJobService
{
    // Queries
    Task<IEnumerable<ServiceJobSummaryDto>> GetGarageJobsAsync(Guid garageId, string? status = null, CancellationToken cancellationToken = default);
    Task<GarageServiceJobDetailDto> GetGarageJobDetailAsync(Guid jobId, Guid garageId, CancellationToken cancellationToken = default);
    Task<CustomerServiceJobDetailDto> GetCustomerJobDetailAsync(Guid serviceRequestId, Guid customerId, CancellationToken cancellationToken = default);
    Task<CustomerServiceJobDetailDto> GetCustomerJobByIdAsync(Guid jobId, Guid customerId, CancellationToken cancellationToken = default);
    Task<AdvisorServiceJobDetailDto> GetAdvisorJobDetailAsync(Guid jobId, CancellationToken cancellationToken = default);
    Task<IEnumerable<ServiceJobSummaryDto>> GetAllJobsAsync(string? status = null, Guid? garageId = null, CancellationToken cancellationToken = default);

    // Lifecycle Commands (Garage operations)
    Task<GarageServiceJobDetailDto> ScheduleJobAsync(Guid jobId, Guid garageId, Guid userId, ScheduleJobRequest request, CancellationToken cancellationToken = default);
    Task<GarageServiceJobDetailDto> ReceiveVehicleAsync(Guid jobId, Guid garageId, Guid userId, ReceiveVehicleRequest request, CancellationToken cancellationToken = default);
    Task<GarageServiceJobDetailDto> StartInspectionAsync(Guid jobId, Guid garageId, Guid userId, StartInspectionRequest request, CancellationToken cancellationToken = default);
    Task<GarageServiceJobDetailDto> CompleteInspectionAsync(Guid jobId, Guid garageId, Guid userId, CompleteInspectionRequest request, CancellationToken cancellationToken = default);
    Task<GarageServiceJobDetailDto> StartWorkAsync(Guid jobId, Guid garageId, Guid userId, StartWorkRequest request, CancellationToken cancellationToken = default);
    Task<GarageServiceJobDetailDto> UpdateJobProgressAsync(Guid jobId, Guid garageId, Guid userId, UpdateJobProgressRequest request, CancellationToken cancellationToken = default);
    Task<GarageServiceJobDetailDto> CompleteWorkAsync(Guid jobId, Guid garageId, Guid userId, CompleteWorkRequest request, CancellationToken cancellationToken = default);
    Task<GarageServiceJobDetailDto> MarkVehicleReadyAsync(Guid jobId, Guid garageId, Guid userId, VehicleReadyRequest request, CancellationToken cancellationToken = default);
    Task<GarageServiceJobDetailDto> HandOverVehicleAsync(Guid jobId, Guid garageId, Guid userId, HandOverVehicleRequest request, CancellationToken cancellationToken = default);
    Task<GarageServiceJobDetailDto> CloseJobAsync(Guid jobId, Guid garageId, Guid userId, CloseJobRequest request, CancellationToken cancellationToken = default);
    Task<GarageServiceJobDetailDto> CancelJobAsync(Guid jobId, Guid garageId, Guid userId, CancelJobRequest request, CancellationToken cancellationToken = default);

    // Additional Work Requests
    Task<AdditionalWorkRequestDto> CreateAdditionalWorkRequestAsync(Guid jobId, Guid garageId, Guid userId, CreateAdditionalWorkRequest request, CancellationToken cancellationToken = default);
    Task<AdditionalWorkRequestDto> ReviewAdditionalWorkRequestAsync(Guid workRequestId, Guid advisorId, ReviewAdditionalWorkRequest request, CancellationToken cancellationToken = default);

    // Internal Booking Integration
    Task<ServiceJobSummaryDto> CreateJobForAcceptedBookingAsync(Guid serviceRequestId, Guid garageAssignmentId, Guid quotationId, Guid garageId, Guid customerUserId, CancellationToken cancellationToken = default);
}
