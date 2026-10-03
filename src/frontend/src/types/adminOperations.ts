// Milestone 9: Admin & Advisor Operations TypeScript Definitions

export interface AdminDashboardKpis {
  totalUsersCount: number;
  totalCustomersCount: number;
  totalGaragesCount: number;
  totalAdvisorsCount: number;
  totalRequestsCount: number;
  totalServiceRequests: number;
  activeServiceRequests: number;
  completedServiceRequests: number;
  cancelledServiceRequests: number;
  totalGarages: number;
  activeGarages: number;
  pendingVerificationGarages: number;
  suspendedGarages: number;
  inactiveGarages: number;
  totalAdvisors: number;
  activeAdvisors: number;
  totalCustomers: number;
  activeCustomers: number;
  serviceJobsInProgress: number;
  completedServiceJobs: number;
  requestsNeedingAttention: number;
  failedNotificationsCount: number;
  recentUsers: Array<{
    id: string;
    email: string;
    fullName: string;
    phoneNumber: string;
    roles: string[];
    isActive: boolean;
    createdAtUtc: string;
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    userEmail?: string;
    entityName?: string;
    entityId?: string;
    details?: string;
    ipAddress?: string;
    timestampUtc: string;
  }>;
  recentRequests: Array<{
    id: string;
    requestNumber: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    vehicleMake: string;
    vehicleModel: string;
    vehicleLicensePlate: string;
    status: string;
    assignedAdvisorName?: string;
    dispatchedGaragesCount: number;
    quotesReceivedCount: number;
    assignedGarageName?: string;
    serviceJobStatus?: string;
    createdAtUtc: string;
  }>;
}

export interface PagedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface AdminRequestSummary {
  id: string;
  requestNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleLicensePlate: string;
  status: string;
  assignedAdvisorId?: string;
  assignedAdvisorName?: string;
  dispatchedGaragesCount: number;
  quotesReceivedCount: number;
  assignedGarageName?: string;
  serviceJobStatus?: string;
  createdAtUtc: string;
  vehicleSummary: string;
  locationSummary: string;
  eligibleGaragesCount: number;
  submittedAtUtc: string;
}

export interface AdminDispatchedGarage {
  garageId: string;
  garageName: string;
  garageEmail: string;
  garagePhone: string;
  distanceKm: number;
  status: string;
  createdAtUtc: string;
  respondedAtUtc?: string;
  declineReason?: string;
}

export interface AdminReceivedQuote {
  quoteId: string;
  quoteNumber: string;
  garageId: string;
  garageName: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  status: string;
  validUntil: string;
  submittedAtUtc: string;
  lineItems: Array<{
    description: string;
    itemType: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    partNumber?: string;
  }>;
}

export interface AdminAdvisorNote {
  id: string;
  advisorId: string;
  advisorName: string;
  note: string;
  createdAtUtc: string;
}

export interface AdminGarageAssignment {
  id: string;
  garageId: string;
  garageName: string;
  selectedQuoteId: string;
  selectedQuoteNumber: string;
  status: string;
  assignmentReason?: string;
  assignedAtUtc: string;
  confirmedAtUtc?: string;
}

export interface AdminCustomerQuotation {
  id: string;
  quotationNumber: string;
  totalAmount: number;
  platformMarginPercentage: number;
  status: string;
  expiresAtUtc: string;
  createdAtUtc: string;
  sentToCustomerAtUtc?: string;
  currentVersionNumber: number;
}

export interface AdminCustomerDecision {
  id: string;
  decision: string;
  decidedAtUtc: string;
  decisionCategory?: string;
  decisionReason?: string;
}

export interface AdminServiceJobSummary {
  id: string;
  jobNumber: string;
  status: string;
  scheduledStartAtUtc?: string;
  vehicleReceivedAtUtc?: string;
  workStartedAtUtc?: string;
  workCompletedAtUtc?: string;
  vehicleHandedOverAtUtc?: string;
  closedAtUtc?: string;
  overallSeverity?: string;
  activitiesCount: number;
  additionalWorkRequestsCount: number;
}

export interface AdminRequestOperationalDetail {
  id: string;
  requestNumber: string;
  status: string;
  createdAtUtc: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleLicensePlate: string;
  problemDescription: string;
  serviceCategory?: string;
  customerLatitude: number;
  customerLongitude: number;
  customerAddress?: string;
  assignedAdvisorId?: string;
  assignedAdvisorName?: string;
  assignedAdvisorEmail?: string;
  dispatchedGarages: AdminDispatchedGarage[];
  quotesReceived: AdminReceivedQuote[];
  advisorNotes: AdminAdvisorNote[];
  currentAssignment?: AdminGarageAssignment;
  customerQuotation?: AdminCustomerQuotation;
  customerDecision?: AdminCustomerDecision;
  serviceJob?: AdminServiceJobSummary;
  timelineEvents: Array<{
    id: string;
    action: string;
    userEmail?: string;
    entityName?: string;
    entityId?: string;
    details?: string;
    ipAddress?: string;
    timestampUtc: string;
  }>;
}

export interface AdminGarageList {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  address: string;
  serviceRadiusKm: number;
  status: 'PendingVerification' | 'Verified' | 'Suspended' | 'Inactive';
  isActive: boolean;
  isOperational: boolean;
  createdAtUtc: string;
  statusChangedAtUtc?: string;
  statusReason?: string;
  activeJobsCount: number;
  totalQuotesCount: number;
}

export interface AdminGarageDetail {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  address: string;
  longitude: number;
  latitude: number;
  serviceRadiusKm: number;
  status: 'PendingVerification' | 'Verified' | 'Suspended' | 'Inactive';
  isActive: boolean;
  isOperational: boolean;
  statusReason?: string;
  statusChangedAtUtc?: string;
  createdAtUtc: string;
  concurrencyToken: string;
  totalDispatchesReceived: number;
  totalQuotesSubmitted: number;
  totalQuotesWon: number;
  winRatePercentage: number;
  activeJobsCount: number;
  completedJobsCount: number;
  recentJobs: Array<{
    id: string;
    jobNumber: string;
    requestNumber: string;
    vehicleSummary: string;
    status: string;
    createdAtUtc: string;
  }>;
  auditHistory: Array<{
    id: string;
    action: string;
    userEmail?: string;
    entityName?: string;
    entityId?: string;
    details?: string;
    ipAddress?: string;
    timestampUtc: string;
  }>;
}

export interface AdminAdvisorList {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  employeeCode: string;
  specialization: string;
  isActive: boolean;
  activeAssignedRequestsCount: number;
  totalQuotesReviewedCount: number;
  activeJobsOverseeingCount: number;
  createdAtUtc: string;
}

export interface AdminCustomerList {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  vehiclesCount: number;
  requestsCount: number;
  createdAtUtc: string;
}

export interface AdminCustomerDetail {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
  preferredContactMethod: string;
  createdAtUtc: string;
  vehicles: Array<{
    id: string;
    licensePlate: string;
    make: string;
    model: string;
    year: number;
    vin?: string;
  }>;
  serviceRequests: AdminRequestSummary[];
}

export interface AdminJobListItem {
  id: string;
  jobNumber: string;
  serviceRequestId: string;
  requestNumber: string;
  garageId: string;
  garageName: string;
  customerName: string;
  vehicleSummary: string;
  status: string;
  scheduledStartAtUtc?: string;
  vehicleReceivedAtUtc?: string;
  workCompletedAtUtc?: string;
  createdAtUtc: string;
}

export interface AttentionItem {
  category: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  referenceId: string;
  referenceNumber: string;
  title: string;
  description: string;
  createdAtUtc: string;
  actionUrl: string;
}

export interface AdminAttentionQueue {
  totalAttentionItemsCount: number;
  items: AttentionItem[];
}

export interface AdminNotificationList {
  id: string;
  userId: string;
  userEmail: string;
  title: string;
  message: string;
  type: string;
  referenceType?: string;
  referenceId?: string;
  isRead: boolean;
  status: 'Pending' | 'Sent' | 'Failed';
  retryCount: number;
  lastAttemptAtUtc?: string;
  errorSummary?: string;
  createdAtUtc: string;
}

export interface SystemHealth {
  overallStatus: string;
  timestampUtc: string;
  uptime: string;
  processMemoryBytes: number;
  database: {
    status: string;
    canConnect: boolean;
    latencyMs: number;
  };
  postGis: {
    status: string;
    isInstalled: boolean;
    version?: string;
  };
  redis: {
    status: string;
    isConnected: boolean;
    latencyMs: number;
  };
  backgroundWorkers: {
    status: string;
    isHealthy: boolean;
    activeWorkerCount: number;
  };
}

export interface AdvisorDashboardKpis {
  assignedRequestsCount: number;
  pendingQuoteReviewsCount: number;
  awaitingCustomerDecisionCount: number;
  activeServiceJobsCount: number;
  additionalWorkPendingReviewCount: number;
  completedJobsThisMonth: number;
  priorityAttentionItems: AttentionItem[];
}

export interface AdvisorWorkQueueItem {
  id: string;
  requestNumber: string;
  customerName: string;
  vehicleSummary: string;
  status: string;
  queueStage: string;
  waitingSinceUtc: string;
  quotesReceivedCount: number;
  hasAdditionalWorkPending: boolean;
  actionUrl: string;
}

export interface AdvisorWorkQueue {
  pendingQuotesReviewCount: number;
  readyToSendQuotesCount: number;
  pendingCustomerDecisionCount: number;
  additionalWorkReviewCount: number;
  activeJobsMonitoringCount: number;
  items: AdvisorWorkQueueItem[];
}
