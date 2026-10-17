import { LegalDoc, h, note, ol, p, section, ul } from './types';

/** Document 2 of the owner-supplied text. Edit wording here only. */
export const refundPolicy: LegalDoc = {
  title: 'Cancellation & Refund Policy',
  subtitle: 'How cancellations, cancellation charges and refunds work',
  effectiveDateField: 'customerPoliciesEffectiveDate',
  lastUpdated: { date: '14 October 2026' },
  sections: [
    section(
      1,
      'Purpose',
      p('This policy explains how customers can cancel a booking, how cancellation charges may apply, and how eligible refunds are processed.'),
      p('Our objective is to ensure that customers understand the financial consequences of cancellation before confirming a booking.')
    ),
    section(
      2,
      'How to Cancel a Booking',
      p('Customers can request cancellation through:'),
      ul(
        'The [contact details](/contact) provided on the BRO Co website.',
        'The official BRO Co WhatsApp or customer support channel.',
        'The booking cancellation feature, where available.'
      ),
      p('Customers should provide their booking ID, vehicle registration details and reason for cancellation.'),
      p('BRO Co will communicate the cancellation status and any applicable charge.'),
      p(
        'A cancellation request is not complete until its receipt is acknowledged or the cancellation is otherwise confirmed through the applicable process.'
      )
    ),
    section(
      3,
      'Cancellation Charges',
      p('Cancellation charges may apply when a confirmed booking has resulted in reasonable operational commitments or costs.'),
      p('The following standard charges are proposed for customer cancellations:'),
      h('A. Customer takes the vehicle to the garage'),
      p(
        'If the customer cancels a confirmed service after committing to visit the assigned garage, a cancellation charge of **7% of the agreed service cost** may apply.'
      ),
      p('This charge is subject to the conditions below and applicable law.'),
      h('B. Vehicle pickup or drop-off is arranged'),
      p(
        'If the customer cancels a confirmed service for which vehicle pickup or drop-off has been arranged, a cancellation charge of **10% of the agreed service cost** may apply.'
      ),
      p('This charge is subject to the conditions below and applicable law.'),
      h('Important conditions'),
      ol(
        'The applicable percentage must be displayed or communicated before the customer confirms the booking.',
        'The calculation must use the clearly disclosed and agreed service-cost basis, not an undisclosed amount or an unapproved repair estimate.',
        'The charge must be fair, proportionate and consistent with applicable law.',
        'BRO Co must not apply the percentage mechanically where it would be unlawful or unfair in the circumstances.',
        'Any amount already paid for work not performed, parts not supplied or services not provided must be considered when calculating the refund.',
        'Any amount already lawfully due for work completed or a separately authorised expense must be itemised and explained.',
        'Where BRO Co unilaterally cancels a confirmed booking, equivalent cancellation charges must be borne by BRO Co where required by applicable law.'
      ),
      note(
        '**Example:** If the agreed service cost is ₹10,000, a 7% cancellation charge would be ₹700, and a 10% cancellation charge would be ₹1,000, provided the relevant charge is applicable and lawful.'
      )
    ),
    section(
      4,
      'Cancellation Before Service Confirmation',
      p('If a customer withdraws a booking request before BRO Co confirms it, no percentage-based cancellation charge should apply.'),
      p(
        'A separately disclosed, customer-authorised and legally recoverable expense, if any, must be assessed individually rather than automatically imposing the standard cancellation percentage.'
      )
    ),
    section(
      5,
      'Cancellation Before Vehicle Pickup or Garage Visit',
      p(
        'Where a booking is confirmed but the customer cancels before the vehicle is collected or the customer begins the agreed garage visit, BRO Co will consider:'
      ),
      ul(
        'The stage of the booking.',
        'Whether a driver was dispatched.',
        'Whether the garage had begun authorised work.',
        'Whether any parts or services were specifically ordered with the customer’s approval.',
        'Any applicable statutory requirements.'
      ),
      p(
        'The 7% or 10% charge will apply only when justified under the disclosed booking terms and applicable law. It will not be treated as an automatic penalty.'
      )
    ),
    section(
      6,
      'Cancellation After Vehicle Pickup',
      p('If the vehicle has already been collected, the customer should contact BRO Co immediately.'),
      p(
        'BRO Co will coordinate with the garage and driver to determine the vehicle’s current status and arrange a safe return or other agreed next step.'
      ),
      p(
        'The final amount payable will be based on the disclosed cancellation terms, authorised work already completed, separately approved costs and applicable law.'
      ),
      p('BRO Co will provide an itemised explanation of any deductions.'),
      p('The vehicle must not be retained as leverage for a disputed amount except where a lawful basis exists.')
    ),
    section(
      7,
      'Cancellation After Inspection or Repair Work Begins',
      p('If inspection has been completed or authorised repair work has begun, the customer may request cancellation.'),
      p('BRO Co will assess:'),
      ul(
        'Work completed and properly documented.',
        'Parts supplied or installed.',
        'Work specifically authorised by the customer.',
        'The status of parts ordered for the customer.',
        'Any applicable cancellation charge.'
      ),
      p('The customer will not be charged for unauthorised additional repairs merely because the garage claims that they were necessary.'),
      p('BRO Co will coordinate with the customer regarding any incomplete repair, vehicle safety concern or return-to-road issue.')
    ),
    section(
      8,
      'When the Garage Contacts the Customer Directly',
      p('If a garage partner discusses additional repairs directly with the customer and the customer agrees:'),
      ol(
        'The garage should record the agreed work and price.',
        'The customer or garage should inform BRO Co of the agreement.',
        'BRO Co should verify the approval through an appropriate record.',
        'If the customer later requests cancellation, BRO Co will assess the documented agreement, authorised work, applicable cancellation terms and any legally recoverable charges.'
      ),
      p(
        'A garage cannot create an additional cancellation charge simply by claiming that the customer agreed verbally. Equally, a customer-approved repair or expense will not automatically become free merely because the customer later cancels.'
      ),
      p('Disputed charges should be reviewed before deductions are finalised.')
    ),
    section(
      9,
      'Cancellation by BRO Co or the Garage Partner',
      p(
        'BRO Co or the garage partner may need to cancel or reschedule because of unavailability, technical limitations, safety concerns or unforeseen operational issues.'
      ),
      p(
        'Where the booking cannot be fulfilled, BRO Co will inform the customer and offer an appropriate alternative, rescheduling or refund, as applicable.'
      ),
      p(
        'If BRO Co unilaterally cancels a confirmed booking, the cancellation-charge provisions required by applicable law will be followed, including equivalent charges where required by the Consumer Protection (E-Commerce) Rules.'
      ),
      p('The customer will not be charged a customer-cancellation fee merely because BRO Co or its garage partner cannot provide the agreed service.')
    ),
    section(
      10,
      'Refund Eligibility',
      p('Refunds may be available in circumstances such as:'),
      ul(
        'Cancellation before the service is provided.',
        'Payment made twice for the same booking.',
        'A booking cancelled by BRO Co where a refund is due.',
        'A service that cannot be provided as agreed.',
        'An overpayment or an incorrect charge.',
        'An approved refund under the service arrangement.',
        'Other circumstances where a refund is required by law.'
      ),
      p(
        'Refund eligibility and the amount will be assessed against the work completed, amounts properly payable, cancellation terms and applicable consumer law.'
      )
    ),
    section(
      11,
      'Refund Calculation',
      p('Where a partial refund is due, BRO Co will calculate it transparently.'),
      {
        type: 'table',
        caption: 'Illustration',
        columns: [{ label: 'Description' }, { label: 'Amount', align: 'right' }],
        rows: [
          ['Customer payment received', '₹10,000'],
          ['Valid, disclosed cancellation charge, if applicable', '₹700'],
          ['Other authorised and properly documented deductions, if applicable', '₹0'],
          ['Illustrative refund', '₹9,300'],
        ],
        totalRow: true,
      },
      p(
        'This example is illustrative only. The actual amount depends on the facts, the applicable cancellation rate, authorised work, any separately approved expenses and applicable law.'
      )
    ),
    section(
      12,
      'Refund Processing Time',
      p(
        'Once a refund is approved, BRO Co will initiate it through the original payment method where feasible, or another mutually agreed lawful method.'
      ),
      p(
        'BRO Co will aim to initiate an approved refund within **5–7 business days**, subject to verification and payment-provider processing.'
      ),
      p('This is a target, not permission to delay a refund beyond any shorter period required by law.'),
      p('The time taken for the money to appear in the customer’s account may depend on the bank, card issuer, UPI provider or payment gateway.'),
      p('Customers will be informed if additional information is reasonably needed to process the refund.')
    ),
    section(
      13,
      'Non-Refundable Amounts',
      p('BRO Co will not describe all payments as automatically non-refundable.'),
      p(
        'An amount may be retained only where there is a valid contractual and legal basis, such as a properly disclosed and applicable cancellation charge, or payment for authorised work already completed.'
      ),
      p('Any deductions will be explained to the customer. Statutory refund rights remain unaffected.')
    ),
    section(
      14,
      'Refund Complaints',
      p('For refund-related questions, customers should contact:'),
      {
        type: 'details',
        items: [
          { label: 'Email', value: '{{supportEmail}}' },
          { label: 'Phone/WhatsApp', value: '{{supportPhone}}' },
          { label: 'Booking ID', value: 'Provide your booking reference' },
        ],
      },
      p('BRO Co will review the payment record, booking status, garage records and cancellation request and communicate its decision.')
    ),
    section(
      15,
      'Policy Updates',
      p('Any updated cancellation or refund terms will be published on the website with an effective date.'),
      p(
        'The terms disclosed when the booking was confirmed will apply to that booking, subject to applicable law and any valid subsequent agreement.'
      )
    ),
  ],
};
