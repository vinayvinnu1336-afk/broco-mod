export type ServiceJobStatus =
  | 'BookingConfirmed'
  | 'Scheduled'
  | 'VehicleReceived'
  | 'Inspection'
  | 'WorkStarted'
  | 'WorkInProgress'
  | 'WorkCompleted'
  | 'VehicleReady'
  | 'HandedOver'
  | 'Closed'
  | 'Cancelled';

export type InspectionSeverity = 'Info' | 'Low' | 'Medium' | 'High' | 'Critical';

export type AdditionalWorkStatus = 'PendingAdvisorReview' | 'Approved' | 'Rejected' | 'Cancelled';

export interface ServiceInspectionDto {
  id: string;
  inspectorUserId: string;
  inspectorName: string;
  inspectionStartedAtUtc: string;
  inspectionCompletedAtUtc?: string | null;
  findings?: string | null;
  recommendations?: string | null;
  customerVisibleSummary?: string | null;
  overallSeverity: InspectionSeverity | string;
  createdAtUtc: string;
}

export interface CustomerServiceInspectionDto {
  inspectionStartedAtUtc: string;
  inspectionCompletedAtUtc?: string | null;
  customerVisibleSummary?: string | null;
  overallSeverity: InspectionSeverity | string;
}

export interface ServiceJobActivityDto {
  id: string;
  activityType: string;
  message: string;
  isCustomerVisible: boolean;
  actorName: string;
  createdAtUtc: string;
}

export interface CustomerJobActivityDto {
  activityType: string;
  message: string;
  createdAtUtc: string;
}

export interface AdditionalWorkRequestDto {
  id: string;
  serviceJobId: string;
  description: string;
  estimatedAdditionalAmount: number;
  reason: string;
  status: AdditionalWorkStatus | string;
  reviewedByAdvisorId?: string | null;
  advisorRemarks?: string | null;
  reviewedAtUtc?: string | null;
  createdAtUtc: string;
}

export interface ServiceJobSummaryDto {
  id: string;
  jobNumber: string;
  serviceRequestId: string;
  requestNumber: string;
  garageId: string;
  garageName: string;
  status: ServiceJobStatus | string;
  scheduledStartAtUtc?: string | null;
  estimatedCompletionAtUtc?: string | null;
  actualWorkCompletedAtUtc?: string | null;
  createdAtUtc: string;
}

export interface GarageServiceJobDetailDto {
  id: string;
  jobNumber: string;
  serviceRequestId: string;
  requestNumber: string;
  customerQuotationId: string;
  quotationNumber: string;
  garageId: string;
  garageName: string;
  status: ServiceJobStatus | string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleLicensePlate: string;
  currentMileageKm?: number | null;
  customerName: string;
  customerPhone: string;
  problemDescription: string;
  customerComplaintSnapshot: string;
  scheduledStartAtUtc?: string | null;
  estimatedCompletionAtUtc?: string | null;
  actualVehicleReceivedAtUtc?: string | null;
  actualWorkStartedAtUtc?: string | null;
  actualWorkCompletedAtUtc?: string | null;
  vehicleReadyAtUtc?: string | null;
  handedOverAtUtc?: string | null;
  closedAtUtc?: string | null;
  cancelledAtUtc?: string | null;
  cancellationReason?: string | null;
  garageInternalNotes?: string | null;
  customerFacingNotes?: string | null;
  inspections: ServiceInspectionDto[];
  activities: ServiceJobActivityDto[];
  additionalWorkRequests: AdditionalWorkRequestDto[];
  concurrencyToken: string;
}

export interface CustomerServiceJobDetailDto {
  id: string;
  jobNumber: string;
  serviceRequestId: string;
  requestNumber: string;
  garageName: string;
  status: ServiceJobStatus | string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleLicensePlate: string;
  scheduledStartAtUtc?: string | null;
  estimatedCompletionAtUtc?: string | null;
  actualVehicleReceivedAtUtc?: string | null;
  actualWorkStartedAtUtc?: string | null;
  actualWorkCompletedAtUtc?: string | null;
  vehicleReadyAtUtc?: string | null;
  handedOverAtUtc?: string | null;
  closedAtUtc?: string | null;
  customerFacingNotes?: string | null;
  inspection?: CustomerServiceInspectionDto | null;
  timeline: CustomerJobActivityDto[];
}

export interface AdvisorServiceJobDetailDto {
  id: string;
  jobNumber: string;
  serviceRequestId: string;
  requestNumber: string;
  customerQuotationId: string;
  quotationNumber: string;
  garageId: string;
  garageName: string;
  status: ServiceJobStatus | string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleLicensePlate: string;
  currentMileageKm?: number | null;
  customerName: string;
  customerPhone: string;
  problemDescription: string;
  customerComplaintSnapshot: string;
  scheduledStartAtUtc?: string | null;
  estimatedCompletionAtUtc?: string | null;
  actualVehicleReceivedAtUtc?: string | null;
  actualWorkStartedAtUtc?: string | null;
  actualWorkCompletedAtUtc?: string | null;
  vehicleReadyAtUtc?: string | null;
  handedOverAtUtc?: string | null;
  closedAtUtc?: string | null;
  cancelledAtUtc?: string | null;
  cancellationReason?: string | null;
  garageInternalNotes?: string | null;
  customerFacingNotes?: string | null;
  inspections: ServiceInspectionDto[];
  activities: ServiceJobActivityDto[];
  additionalWorkRequests: AdditionalWorkRequestDto[];
  concurrencyToken: string;
}

export interface ScheduleJobRequest {
  scheduledStartAtUtc: string;
  estimatedCompletionAtUtc: string;
  notes?: string;
}

export interface ReceiveVehicleRequest {
  currentMileageKm?: number;
  notes?: string;
}

export interface StartInspectionRequest {
  severity: InspectionSeverity;
}

export interface CompleteInspectionRequest {
  findings?: string;
  recommendations?: string;
  customerVisibleSummary?: string;
  severity: InspectionSeverity;
}

export interface StartWorkRequest {
  notes?: string;
}

export interface UpdateJobProgressRequest {
  progressNotes: string;
  isCustomerVisible: boolean;
}

export interface CompleteWorkRequest {
  notes?: string;
  customerFacingNotes?: string;
}

export interface VehicleReadyRequest {
  customerFacingNotes?: string;
}

export interface HandOverVehicleRequest {
  handoverNotes?: string;
}

export interface CloseJobRequest {
  closingRemarks?: string;
}

export interface CancelJobRequest {
  reason: string;
}

export interface CreateAdditionalWorkRequest {
  description: string;
  estimatedAdditionalAmount: number;
  reason: string;
}

export interface ReviewAdditionalWorkRequest {
  approved: boolean;
  remarks?: string;
}
