import { LegalDoc, ol, p, section, ul } from './types';

/** Document 1 of the owner-supplied text. Edit wording here only. */
export const customerTerms: LegalDoc = {
  title: 'Customer Terms & Conditions',
  subtitle: 'For customers booking vehicle services through BRO Co',
  effectiveDateField: 'customerPoliciesEffectiveDate',
  lastUpdated: { date: '14 October 2026' },
  sections: [
    section(
      1,
      'Introduction',
      p('Welcome to BroCo Mobility Solutions (“BRO Co”, “we”, “our” or “us”).'),
      p(
        'BRO Co provides a vehicle-service coordination platform that connects customers with selected garage partners for vehicle inspection, servicing, maintenance and repair-related services.'
      ),
      p(
        'Our objective is to provide customers with greater transparency, informed decision-making, documented repair approvals and a convenient vehicle-service experience.'
      ),
      p(
        'By accessing our website, submitting a service request, booking a service or using our services, you agree to these Terms & Conditions.'
      )
    ),
    section(
      2,
      'Scope of Services',
      p('BRO Co may facilitate the following services, depending on availability:'),
      ul(
        'Periodic vehicle servicing and maintenance.',
        'Mechanical and electrical repairs.',
        'Air-conditioning services.',
        'Denting, painting, rubbing and polishing.',
        'Suspension, clutch, flywheel and related repairs.',
        'Vehicle inspection and diagnostic coordination.',
        'Vehicle pickup and drop-off, where specifically arranged.',
        'Service updates, quotations, approvals and repair documentation.'
      ),
      p(
        'All services are subject to vehicle eligibility, location coverage, garage capability, parts availability and confirmation of the booking.'
      ),
      p('BRO Co does not promise that every service will be available for every vehicle or location.')
    ),
    section(
      3,
      'Role of BRO Co and Garage Partners',
      p('BRO Co coordinates service requests and facilitates communication between customers and selected garage partners.'),
      p(
        'The actual inspection, diagnosis, maintenance and repair work is carried out by the assigned garage partner or other identified service provider.'
      ),
      p('BRO Co will communicate the service arrangement and the responsible service provider to the customer.'),
      p('The customer acknowledges that:'),
      ol(
        'Initial estimates may change after physical inspection.',
        'Final repair work must be based on the customer’s informed approval.',
        'BRO Co coordinates the process and maintains service records, but does not automatically perform the mechanical work itself.',
        'Responsibility for particular services, workmanship, parts and warranties will be determined by the agreed service arrangement and applicable law.'
      ),
      p('Nothing in these Terms removes any consumer right or legal responsibility that cannot lawfully be excluded.')
    ),
    section(
      4,
      'Booking and Customer Information',
      p('Customers must provide accurate information, including:'),
      ul(
        'Name and contact number.',
        'Vehicle make, model and registration details, where required.',
        'Vehicle location and preferred service.',
        'Description of the problem or requested work.',
        'Preferred service date and pickup/drop-off requirements.'
      ),
      p('Customers must ensure that they are the vehicle owner or are authorised to arrange the service.'),
      p('BRO Co may contact customers to verify information, clarify complaints, confirm availability and communicate quotations.'),
      p('A booking request is not a confirmed appointment until BRO Co confirms acceptance and the agreed service details.')
    ),
    section(
      5,
      'Inspection and Quotation',
      p('The initial price displayed or communicated may be an estimate based on the information available.'),
      p('The garage partner may identify additional work after inspecting the vehicle.'),
      p(
        'Before additional chargeable work is performed, the customer must receive the relevant explanation and quotation and provide approval through an accepted method, such as the website, WhatsApp, SMS or another recorded communication channel.'
      ),
      p('The quotation should identify, where applicable:'),
      ul(
        'Labour charges.',
        'Parts and consumables.',
        'Taxes and other applicable charges.',
        'Additional recommended or necessary repairs.',
        'Estimated completion time.',
        'Applicable warranty terms.'
      ),
      p(
        'No customer should be charged for unauthorised additional repairs, except for amounts lawfully payable under a separately disclosed and agreed arrangement.'
      ),
      p(
        'If the customer declines additional work, BRO Co will coordinate the next steps with the garage, taking account of vehicle safety, work already authorised and any applicable charges.'
      )
    ),
    section(
      6,
      'Customer Approval and Direct Communication with Garages',
      p('Customers may communicate with the assigned garage regarding technical details, inspection findings and repair recommendations.'),
      p(
        'However, customers should request that quotations, additional work approvals, changes in scope and payment arrangements be recorded with BRO Co.'
      ),
      p(
        'Where a customer agrees to a quotation directly with a garage partner, the agreement and its financial consequences will be assessed using the documented communication and the service arrangement.'
      ),
      p('BRO Co will not automatically treat an unverified verbal statement by either party as proof of customer approval.'),
      p('Customers and garage partners are encouraged to report any disagreement to BRO Co before proceeding with disputed additional work.')
    ),
    section(
      7,
      'Vehicle Pickup and Drop-off',
      p('Pickup and drop-off are available only when specifically agreed and confirmed.'),
      p('Where pickup or delivery is arranged:'),
      ol(
        'The designated driver or authorised representative should be identified to the customer.',
        'The vehicle’s visible condition should be documented through photographs or other inspection records before collection, where practicable.',
        'The customer should disclose known damage, existing faults, missing accessories and other relevant conditions.',
        'Handover, pickup and delivery may be verified through an OTP, acknowledgment or another reasonable verification process.',
        'The customer should check the vehicle at delivery and promptly report any apparent discrepancy.'
      ),
      p('Customers should remove cash, valuables, personal documents and unnecessary belongings before handover.'),
      p(
        'BRO Co and its partners must handle vehicles with reasonable care. These provisions do not waive liability for negligence, unauthorised use, misappropriation or other legally actionable conduct.'
      )
    ),
    section(
      8,
      'Repair Documentation and Updates',
      p('BRO Co may maintain service records, including:'),
      ul(
        'Vehicle-condition photographs.',
        'Inspection findings.',
        'Quotations and customer approvals.',
        'Repair progress photographs or videos.',
        'Pickup and drop-off records.',
        'Invoices, payment records and warranty information.'
      ),
      p('These records are intended to improve transparency and help resolve disputes.'),
      p(
        'The availability of photographs, live tracking, video updates or other features depends on the technology, network connectivity and service arrangement available at the time.'
      )
    ),
    section(
      9,
      'Payments, Invoices and Taxes',
      p('The payment arrangement will be communicated before the customer confirms the booking.'),
      p(
        'Depending on the booking, the customer may pay BRO Co, the garage partner or another authorised payment recipient identified during checkout.'
      ),
      p('The customer must pay only the amounts properly disclosed, agreed and lawfully payable for the service.'),
      p('Invoices and receipts will be provided by the relevant supplier or payment recipient as applicable.'),
      p('Applicable taxes will be charged in accordance with law.'),
      p(
        'Customers should not make additional payments to a driver or garage representative without an appropriate invoice, receipt or recorded confirmation.'
      )
    ),
    section(
      10,
      'Service Quality and Warranty',
      p('BRO Co aims to work with selected garage partners and facilitate transparent service delivery.'),
      p('Any warranty on labour, parts or repairs will be subject to the specific warranty terms disclosed for the service.'),
      p(
        'The customer should retain the invoice and warranty documentation and report any covered defect within the applicable warranty period.'
      ),
      p(
        'Warranty coverage may exclude unrelated faults, ordinary wear and tear, misuse, external damage or unauthorised subsequent repairs, where those exclusions are valid and properly disclosed.'
      ),
      p('No provision in this document excludes statutory consumer remedies or rights that apply under Indian law.')
    ),
    section(
      11,
      'Customer Responsibilities',
      p('Customers agree to:'),
      ul(
        'Provide accurate vehicle and contact information.',
        'Disclose known safety concerns and relevant vehicle conditions.',
        'Review quotations before approving repairs.',
        'Pay agreed and lawful charges.',
        'Cooperate with reasonable pickup, delivery and verification procedures.',
        'Avoid providing false information or making fraudulent payment claims.',
        'Treat BRO Co personnel and garage partners respectfully.'
      ),
      p('Customers must not use the platform for unlawful purposes or attempt to interfere with its operation.')
    ),
    section(
      12,
      'Delays and Unforeseen Circumstances',
      p('Service completion times are estimates unless expressly confirmed as guaranteed.'),
      p(
        'Delays may occur because of parts availability, additional faults, technical complexity, customer approval delays, weather, transport disruption or other circumstances outside reasonable control.'
      ),
      p('BRO Co will make reasonable efforts to communicate material delays and coordinate an appropriate solution.'),
      p(
        'Any extra charge or revised completion estimate must be communicated before the customer becomes liable for the additional work or expense, subject to applicable law.'
      )
    ),
    section(
      13,
      'Complaints and Disputes',
      p('Customers should first contact BRO Co through the [contact details](/contact) published on the website.'),
      p('Please provide the booking reference, vehicle details, invoice, photographs and a description of the issue, where available.'),
      p('BRO Co will review the records, seek information from the relevant garage or driver and communicate the proposed resolution.'),
      p(
        'Nothing in this clause prevents a customer from exercising rights available through a competent consumer authority, consumer commission or other lawful forum.'
      )
    ),
    section(
      14,
      'Cancellation and Refunds',
      p(
        'All cancellations, cancellation charges, refunds and related procedures are governed by the separate **[Cancellation & Refund Policy](/refund-policy)** published on our website.'
      ),
      p('Customers should review that policy before confirming a booking.')
    ),
    section(
      15,
      'Website Availability and Intellectual Property',
      p('BRO Co may update, maintain or temporarily suspend website features for operational, technical or security reasons.'),
      p(
        'Website text, branding, graphics and other original content belong to BRO Co or the relevant rights holder, subject to applicable third-party rights.'
      ),
      p('Users may not reproduce or commercially exploit protected content without permission.')
    ),
    section(
      16,
      'Changes to These Terms',
      p('BRO Co may revise these Terms to reflect changes in services, business operations or legal requirements.'),
      p('The updated version and effective date will be published on the website. Material changes will be communicated where required by law.'),
      p('Changes will not retrospectively remove rights already accrued to customers or override applicable law.')
    ),
    section(
      17,
      'Governing Law',
      p('These Terms are governed by the laws of India.'),
      p(
        'Disputes will be addressed by the competent authorities or courts having jurisdiction under applicable law. Nothing in these Terms restricts a consumer’s statutory right to approach a competent consumer commission.'
      )
    ),
    section(18, 'Contact Information', {
      type: 'details',
      title: '**{{legalName}}**',
      items: [
        { label: 'Website', value: '{{website}}' },
        { label: 'Email', value: '{{supportEmail}}' },
        { label: 'Phone/WhatsApp', value: '{{supportPhone}}' },
        { label: 'Business address', value: '{{address}}' },
        { label: 'Grievance Officer', value: '{{grievanceOfficerName}}, {{grievanceOfficerDesignation}}' },
        { label: 'Grievance email', value: '{{grievanceEmail}}' },
      ],
    }),
  ],
};
