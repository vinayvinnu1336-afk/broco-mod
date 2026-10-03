using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BroCoMod.Api.Controllers.v1;

[ApiController]
[Route("api/v1/admin/finance")]
[Authorize(Roles = $"{AppRoles.SuperAdmin},{AppRoles.Advisor}")]
public class AdminFinanceController : ControllerBase
{
    private readonly IAdminFinanceService _adminFinanceService;
    private readonly IPaymentService _paymentService;
    private readonly ISettlementService _settlementService;
    private readonly IInvoiceService _invoiceService;
    private readonly IFinancialLedgerService _ledgerService;
    private readonly ICurrentUserService _currentUserService;

    public AdminFinanceController(
        IAdminFinanceService adminFinanceService,
        IPaymentService paymentService,
        ISettlementService settlementService,
        IInvoiceService invoiceService,
        IFinancialLedgerService ledgerService,
        ICurrentUserService currentUserService)
    {
        _adminFinanceService = adminFinanceService;
        _paymentService = paymentService;
        _settlementService = settlementService;
        _invoiceService = invoiceService;
        _ledgerService = ledgerService;
        _currentUserService = currentUserService;
    }

    private Guid GetEffectiveAdminId()
    {
        return _currentUserService.UserId ?? Guid.Empty;
    }

    [HttpGet("overview")]
    [ProducesResponseType(typeof(ApiResponse<FinanceOverviewDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOverview(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        CancellationToken cancellationToken)
    {
        var overview = await _adminFinanceService.GetFinanceOverviewAsync(fromUtc, toUtc, cancellationToken);
        return Ok(ApiResponse<FinanceOverviewDto>.Ok(overview));
    }

    [HttpGet("payments")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<PaymentDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPayments(
        [FromQuery] PaymentFilterDto filter,
        CancellationToken cancellationToken)
    {
        var result = await _adminFinanceService.GetAdminPaymentsAsync(filter, cancellationToken);
        return Ok(ApiResponse<PagedResult<PaymentDto>>.Ok(result));
    }

    [HttpGet("payments/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<PaymentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPaymentById(Guid id, CancellationToken cancellationToken)
    {
        var adminId = GetEffectiveAdminId();
        var payment = await _paymentService.GetPaymentByIdAsync(id, adminId, AppRoles.SuperAdmin, cancellationToken);
        if (payment == null)
            return NotFound(ApiResponse<object>.Fail("Payment not found."));

        return Ok(ApiResponse<PaymentDto>.Ok(payment));
    }

    [HttpGet("settlements")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<GarageSettlementDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSettlements(
        [FromQuery] SettlementFilterDto filter,
        CancellationToken cancellationToken)
    {
        var result = await _adminFinanceService.GetAdminSettlementsAsync(filter, cancellationToken);
        return Ok(ApiResponse<PagedResult<GarageSettlementDto>>.Ok(result));
    }

    [HttpPost("settlements/{id:guid}/complete")]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    [ProducesResponseType(typeof(ApiResponse<GarageSettlementDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CompleteSettlement(
        Guid id,
        [FromBody] CompleteSettlementRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var adminId = GetEffectiveAdminId();
            var result = await _settlementService.MarkSettlementCompletedAsync(
                id, request.PayoutTransactionRef, request.ReferenceNotes, adminId, cancellationToken);
            return Ok(ApiResponse<GarageSettlementDto>.Ok(result, "Settlement marked as completed."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpPost("payments/{id:guid}/refund")]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    [ProducesResponseType(typeof(ApiResponse<PaymentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ProcessRefund(
        Guid id,
        [FromBody] RefundPaymentRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var adminId = GetEffectiveAdminId();
            var result = await _paymentService.ProcessRefundAsync(
                id, request.Amount, request.Reason, adminId, cancellationToken);
            return Ok(ApiResponse<PaymentDto>.Ok(result, "Refund processed successfully."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpPost("invoices/{id:guid}/void")]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    [ProducesResponseType(typeof(ApiResponse<InvoiceDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> VoidInvoice(
        Guid id,
        [FromBody] RefundPaymentRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var adminId = GetEffectiveAdminId();
            var result = await _invoiceService.VoidInvoiceAsync(
                id, request.Reason, adminId, cancellationToken);
            return Ok(ApiResponse<InvoiceDto>.Ok(result, "Invoice voided successfully."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpGet("ledger")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<FinancialLedgerEntryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetLedgerEntries(
        [FromQuery] Guid? accountId,
        [FromQuery] string? accountType,
        CancellationToken cancellationToken)
    {
        var entries = await _ledgerService.GetLedgerEntriesAsync(accountId, accountType, cancellationToken);
        return Ok(ApiResponse<IEnumerable<FinancialLedgerEntryDto>>.Ok(entries));
    }
}
