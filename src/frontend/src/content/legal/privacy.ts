import { LegalDoc, h, p, section, ul } from './types';

/** Document 3 of the owner-supplied text. Edit wording here only. */
export const privacyPolicy: LegalDoc = {
  title: 'Privacy Policy',
  subtitle: 'How BRO Co collects, uses, shares and protects personal information',
  effectiveDateField: 'customerPoliciesEffectiveDate',
  lastUpdated: { date: '14 October 2026' },
  sections: [
    section(
      1,
      'Introduction',
      p('BRO Co Mobility Solutions respects the privacy of customers and website visitors.'),
      p(
        'This Privacy Policy explains how we collect, use, store, share and protect personal information when customers visit our website, make a booking, communicate with us or use our vehicle-service coordination services.'
      ),
      p(
        'BRO Co will handle personal data in accordance with applicable Indian law, including the Digital Personal Data Protection Act, 2023, and the rules and provisions applicable to the relevant processing activity and effective date.'
      )
    ),
    section(
      2,
      'Information We Collect',
      p('Depending on how you use our services, we may collect the following information.'),
      h('A. Personal and contact information'),
      ul('Name.', 'Mobile number.', 'Email address.', 'Contact and communication preferences.'),
      h('B. Vehicle information'),
      ul(
        'Vehicle make and model.',
        'Registration number, where required.',
        'Vehicle location.',
        'Reported mechanical problems.',
        'Service history and previous booking records.',
        'Inspection photographs and repair records.'
      ),
      h('C. Booking and transaction information'),
      ul(
        'Booking ID and service details.',
        'Quotations and customer approvals.',
        'Payment status and refund records.',
        'Invoices and warranty details.',
        'Customer complaints and support communications.'
      ),
      p(
        'Payment-card details or banking credentials should be handled by the authorised payment provider wherever possible, rather than stored by BRO Co.'
      ),
      h('D. Pickup and delivery information'),
      p('Where pickup or delivery is requested, we may process:'),
      ul(
        'Pickup and drop-off addresses.',
        'Driver assignment and contact details.',
        'OTP or handover verification records.',
        'Relevant trip-status and location information.',
        'Vehicle-condition photographs before and after transport.'
      ),
      p(
        'Precise or continuous location information should be collected only when necessary for a disclosed service purpose and with the appropriate permission or other lawful basis.'
      ),
      h('E. Technical information'),
      p(
        'Our website or service providers may collect limited technical information, such as device or browser details, access logs, security events and cookie-related information, where applicable.'
      )
    ),
    section(
      3,
      'Why We Use Your Information',
      p('BRO Co may use personal data to:'),
      ul(
        'Register and manage bookings.',
        'Contact customers about service requests.',
        'Assign an appropriate garage partner.',
        'Coordinate vehicle pickup and delivery.',
        'Obtain and record repair approvals.',
        'Share relevant information with the assigned garage or driver.',
        'Process payments, invoices and refunds.',
        'Maintain service history and warranty records.',
        'Investigate complaints, disputes, suspected fraud or security incidents.',
        'Improve website functionality and service quality.',
        'Meet legal, accounting, tax and regulatory obligations.',
        'Send marketing communications where permitted and, where required, with consent.'
      ),
      p('We will not use personal data for an unrelated purpose in a manner inconsistent with applicable law.')
    ),
    section(
      4,
      'Sharing Information with Third Parties',
      p('BRO Co may share relevant information with:'),
      ul(
        'The garage partner assigned to the booking.',
        'An authorised pickup or delivery driver.',
        'Payment gateways, banks and payment processors.',
        'Website hosting, communication and technical service providers.',
        'Professional advisers, auditors or insurers where appropriate.',
        'Government authorities or law-enforcement agencies when legally required.'
      ),
      p(
        'For example, an assigned garage may need your vehicle model, reported problem and contact details to inspect the vehicle and provide a quotation.'
      ),
      p('A driver may need your pickup address and contact number to collect or return the vehicle.'),
      p('BRO Co will seek to limit shared information to what is reasonably necessary for the relevant purpose.'),
      p(
        'We do not authorise partners to use customer information for unrelated marketing or independent commercial purposes without an appropriate lawful basis.'
      )
    ),
    section(
      5,
      'Vehicle Photographs, Videos and Service Records',
      p(
        'BRO Co or its service partners may create vehicle-condition photographs, inspection records, repair photographs and videos to document the service.'
      ),
      p('These records may be used for:'),
      ul(
        'Recording the vehicle’s condition.',
        'Documenting authorised repairs.',
        'Providing customer updates.',
        'Verifying pickup and delivery.',
        'Investigating disputes and warranty claims.',
        'Meeting applicable legal or contractual obligations.'
      ),
      p(
        'Records should be captured and shared in a way that avoids unnecessary exposure of faces, identity documents, addresses or other personal information.'
      ),
      p(
        'BRO Co will not publish identifiable customer photographs or vehicle details in public advertising without the required permission or other valid legal basis.'
      )
    ),
    section(
      6,
      'Payments and Payment Security',
      p('Online payments may be processed through third-party payment gateways, banks or other authorised payment providers.'),
      p('Those providers may process transaction information under their own applicable terms and privacy notices.'),
      p('BRO Co may receive payment confirmations, transaction references, payment status and refund information.'),
      p(
        'Customers should never share their UPI PIN, ATM PIN, card PIN, password or OTP with a person claiming to be a BRO Co employee. A legitimate payment process should not require the customer to disclose their PIN to BRO Co.'
      )
    ),
    section(
      7,
      'Cookies and Website Technologies',
      p('Our website may use cookies or similar technologies to support essential functionality, security, analytics and user preferences.'),
      p('Where consent is required, BRO Co will seek the appropriate consent before using the relevant technology.'),
      p(
        'Customers may be able to manage cookies through their browser settings or available website controls. Disabling certain cookies may affect website functionality.'
      ),
      p('BRO Co will disclose material third-party analytics or advertising technologies used on the website where required.')
    ),
    section(
      8,
      'Data Retention',
      p(
        'BRO Co will retain personal information only for as long as reasonably necessary for the stated purpose or as required by applicable law.'
      ),
      p('For example:'),
      ul(
        'Booking and repair records may be retained to provide service support and handle warranty claims.',
        'Payment and invoice records may be retained for accounting and tax obligations.',
        'Complaint and dispute records may be retained for appropriate resolution and legal compliance.',
        'Technical logs may be retained for a limited period to support security and troubleshooting.'
      ),
      p(
        'When information is no longer required, BRO Co will delete it or anonymise it where appropriate, unless retention is legally required or otherwise lawfully justified.'
      )
    ),
    section(
      9,
      'Data Security',
      p(
        'BRO Co will take reasonable and appropriate steps to protect personal information against unauthorised access, disclosure, alteration, loss or misuse.'
      ),
      p(
        'Depending on the systems used, these measures may include access restrictions, secure authentication, limited staff access, secure data transmission, backups and vendor controls.'
      ),
      p('No internet-based system can be guaranteed to be completely secure.'),
      p(
        'If a personal-data breach occurs, BRO Co will take appropriate steps to investigate, contain and address the incident and make notifications where required by applicable law.'
      )
    ),
    section(
      10,
      'Your Privacy Rights',
      p('Subject to the applicable law and its commencement provisions, you may have rights to:'),
      ul(
        'Request information about personal data being processed.',
        'Request correction or updating of inaccurate information.',
        'Request erasure of personal data where applicable.',
        'Withdraw consent where processing is based on consent.',
        'Raise a privacy complaint with BRO Co.',
        'Exercise other rights available under applicable law.'
      ),
      p('Requests can be sent to {{privacyEmail}}.'),
      p(
        'BRO Co may need to verify your identity or authority before acting on a request. We will respond in accordance with the applicable legal requirements.'
      ),
      p(
        'Withdrawal of consent does not invalidate processing already lawfully carried out, and some information may need to be retained for legal obligations or the establishment, exercise or defence of legal claims.'
      )
    ),
    section(
      11,
      'Marketing Communications',
      p('BRO Co may send service-related messages about booking confirmation, repair approval, pickup, delivery, payment and refunds.'),
      p('Marketing messages will be handled in accordance with applicable law and relevant consent or preference requirements.'),
      p('Customers may opt out of marketing communications through the available unsubscribe mechanism or by contacting BRO Co.'),
      p('Opting out of marketing will not prevent essential communications needed to fulfil an active booking or comply with legal obligations.')
    ),
    section(
      12,
      'Children’s Personal Data',
      p('BRO Co’s services are intended for individuals legally able to enter into the relevant service arrangements.'),
      p(
        'BRO Co does not knowingly seek unnecessary personal data from children. Where applicable law requires parental consent or additional safeguards for a child’s personal data, BRO Co will follow those requirements.'
      )
    ),
    section(
      13,
      'Third-Party Websites and Services',
      p('Our website may contain links to payment providers or other third-party services.'),
      p(
        'Those services may have their own privacy practices and terms. BRO Co is not responsible for the privacy practices of independent websites, except to the extent responsibility is imposed by applicable law.'
      ),
      p('Customers should review the relevant third party’s privacy notice before providing information directly to it.')
    ),
    section(
      14,
      'Changes to This Privacy Policy',
      p('BRO Co may update this Privacy Policy to reflect changes in its services, technology or legal obligations.'),
      p('The latest version and its effective date will be published on the website. Material changes will be communicated where required by law.')
    ),
  ],
};
