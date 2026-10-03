using BroCoMod.Application.DTOs;
using BroCoMod.Application.Interfaces;
using BroCoMod.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BroCoMod.Api.Controllers.v1;

[ApiController]
[Route("api/v1/customer")]
[Authorize(Roles = $"{AppRoles.Customer},{AppRoles.SuperAdmin}")]
public class CustomerPaymentController : ControllerBase
{
    private readonly IPaymentService _paymentService;
    private readonly IInvoiceService _invoiceService;
    private readonly ICurrentUserService _currentUserService;

    public CustomerPaymentController(
        IPaymentService paymentService,
        IInvoiceService invoiceService,
        ICurrentUserService currentUserService)
    {
        _paymentService = paymentService;
        _invoiceService = invoiceService;
        _currentUserService = currentUserService;
    }

    private Guid GetEffectiveCustomerId()
    {
        var customerId = _currentUserService.CustomerId ?? _currentUserService.UserId;
        if (!customerId.HasValue)
        {
            throw new UnauthorizedAccessException("Authenticated user has no valid customer profile.");
        }
        return customerId.Value;
    }

    [HttpPost("payments/initiate")]
    [ProducesResponseType(typeof(ApiResponse<InitiatePaymentResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> InitiatePayment(
        [FromBody] InitiatePaymentRequestDto request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKeyHeader,
        CancellationToken cancellationToken)
    {
        try
        {
            var customerId = GetEffectiveCustomerId();
            var key = !string.IsNullOrWhiteSpace(request.IdempotencyKey) ? request.IdempotencyKey : idempotencyKeyHeader;
            var modifiedRequest = request with { IdempotencyKey = key };

            var result = await _paymentService.InitiateQuotationPaymentAsync(modifiedRequest, customerId, cancellationToken);
            return Ok(ApiResponse<InitiatePaymentResponseDto>.Ok(result, "Payment order initiated successfully."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpPost("quotes/{quotationId:guid}/pay")]
    [ProducesResponseType(typeof(ApiResponse<InitiatePaymentResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> PayQuotation(
        Guid quotationId,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKeyHeader,
        CancellationToken cancellationToken)
    {
        try
        {
            var customerId = GetEffectiveCustomerId();
            var request = new InitiatePaymentRequestDto(quotationId, idempotencyKeyHeader);
            var result = await _paymentService.InitiateQuotationPaymentAsync(request, customerId, cancellationToken);
            return Ok(ApiResponse<InitiatePaymentResponseDto>.Ok(result, "Payment order initiated successfully."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpPost("payments/initiate-additional-work")]
    [ProducesResponseType(typeof(ApiResponse<InitiatePaymentResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> InitiateAdditionalWorkPayment(
        [FromBody] InitiateAdditionalWorkPaymentRequestDto request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKeyHeader,
        CancellationToken cancellationToken)
    {
        try
        {
            var customerId = GetEffectiveCustomerId();
            var key = !string.IsNullOrWhiteSpace(request.IdempotencyKey) ? request.IdempotencyKey : idempotencyKeyHeader;
            var modifiedRequest = request with { IdempotencyKey = key };

            var result = await _paymentService.InitiateAdditionalWorkPaymentAsync(modifiedRequest, customerId, cancellationToken);
            return Ok(ApiResponse<InitiatePaymentResponseDto>.Ok(result, "Additional work payment initiated successfully."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpPost("payments/verify")]
    [ProducesResponseType(typeof(ApiResponse<PaymentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> VerifyPayment(
        [FromBody] VerifyPaymentRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var customerId = GetEffectiveCustomerId();
            var result = await _paymentService.VerifyAndCompletePaymentAsync(request, customerId, cancellationToken);
            return Ok(ApiResponse<PaymentDto>.Ok(result, "Payment successfully verified and completed."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpGet("payments")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<PaymentDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPayments(CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        var payments = await _paymentService.GetCustomerPaymentsAsync(customerId, cancellationToken);
        return Ok(ApiResponse<IEnumerable<PaymentDto>>.Ok(payments));
    }

    [HttpGet("payments/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<PaymentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPaymentById(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var customerId = GetEffectiveCustomerId();
            var payment = await _paymentService.GetPaymentByIdAsync(id, customerId, AppRoles.Customer, cancellationToken);
            if (payment == null)
                return NotFound(ApiResponse<object>.Fail("Payment not found."));

            return Ok(ApiResponse<PaymentDto>.Ok(payment));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpGet("invoices")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<InvoiceDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetInvoices(CancellationToken cancellationToken)
    {
        var customerId = GetEffectiveCustomerId();
        var invoices = await _invoiceService.GetCustomerInvoicesAsync(customerId, cancellationToken);
        return Ok(ApiResponse<IEnumerable<InvoiceDto>>.Ok(invoices));
    }

    [HttpGet("invoices/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<InvoiceDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetInvoiceById(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var customerId = GetEffectiveCustomerId();
            var invoice = await _invoiceService.GetInvoiceByIdAsync(id, customerId, AppRoles.Customer, cancellationToken);
            if (invoice == null)
                return NotFound(ApiResponse<object>.Fail("Invoice not found."));

            return Ok(ApiResponse<InvoiceDto>.Ok(invoice));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message));
        }
    }

    [HttpGet("invoices/by-payment/{paymentId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<InvoiceDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetInvoiceByPaymentId(Guid paymentId, CancellationToken cancellationToken)
    {
        try
        {
            var customerId = GetEffectiveCustomerId();
            var invoice = await _invoiceService.GetInvoiceByPaymentIdAsync(paymentId, customerId, AppRoles.Customer, cancellationToken);
            if (invoice == null)
                return NotFound(ApiResponse<object>.Fail("Invoice not found for this payment."));

            return Ok(ApiResponse<InvoiceDto>.Ok(invoice));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message));
        }
    }
}
