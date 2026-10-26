import { useState } from "react";
import FaceCapture from "./FaceCapture";

const BENEFITS = [
  "Death Benefit",
  "Funeral Benefit",
  "Education Protector",
  "Disability or income protection",
  "Critical illness cover",
  "Homeloan Protector",
  "I need help choosing",
];

const REQUIRED_DOCUMENTS = [
  { id: "application", label: "Completed application and consent paperwork", hint: "Demo checklist item. Exact insurer forms depend on the selected benefits." },
  { id: "identity", label: "Identity document (South African ID or passport)", hint: "Use a clear image or PDF." },
  { id: "bank", label: "Bank account or debit-order confirmation", hint: "The guide refers to valid debit-order details for immediate cover." },
];

const CONDITIONAL_DOCUMENTS = [
  { id: "financial", label: "Financial questionnaire or proof of income", hint: "May be requested depending on benefit amounts and financial underwriting." },
  { id: "medical", label: "Medical evidence or requested test results", hint: "Underwriting requirements vary by benefit, age, and amount applied for." },
  { id: "loan", label: "Loan or mortgage confirmation", hint: "May be requested for a loan-related Homeloan Protector application." },
];

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function MembershipApplication({ user, onBack }) {
  const [selectedBenefits, setSelectedBenefits] = useState([]);
  const [files, setFiles] = useState({});
  const [fileError, setFileError] = useState("");
  const [faceCaptured, setFaceCaptured] = useState(false);
  const [requestReference, setRequestReference] = useState("");

  function selectFile(id, file) {
    setFileError("");
    if (!file) {
      setFiles(current => ({ ...current, [id]: null }));
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError("Choose a PDF, JPEG, PNG, or WebP file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError("Each demo file must be 10 MB or smaller.");
      return;
    }
    setFiles(current => ({ ...current, [id]: file }));
  }

  function toggleBenefit(benefit) {
    setRequestReference("");
    setSelectedBenefits(current => current.includes(benefit)
      ? current.filter(item => item !== benefit)
      : [...current, benefit]);
  }

  function requestReview(event) {
    event.preventDefault();
    if (!faceCaptured || !selectedBenefits.length || REQUIRED_DOCUMENTS.some(document => !files[document.id])) return;
    setRequestReference(`DEMO-${Date.now().toString().slice(-8)}`);
  }

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Account holder";

  return (
    <main className="hp-main">
      <div className="hp-wrap">
        <div className="hp-page-title hp-membership-title">
          <div>
            <span className="hp-demo-label">PRESENTATION APPLICATION</span>
            <h1>Become a MediCare member</h1>
            <p>Tell us which benefit areas you want to explore and prepare the documents an adviser may need.</p>
          </div>
          <button type="button" className="hp-btn-ghost" onClick={onBack}>← Back to dashboard</button>
        </div>

        <div className="hp-membership-notice" role="note">
          <strong>Demo document checklist.</strong> The technical guide says requirements depend on the benefits selected and underwriting. The checklist below is for this presentation flow; it is not an official universal insurer checklist. This prototype does not upload files or notify a human reviewer. The selfie remains in your browser and is not used to verify identity.
        </div>

        {requestReference ? (
          <section className="hp-membership-success" role="status">
            <div className="hp-membership-success-icon">✓</div>
            <span className="hp-demo-label">DEMO REQUEST PREPARED</span>
            <h2>Human review step demonstrated</h2>
            <p>Reference <strong>{requestReference}</strong> is a local demo confirmation. No documents left your browser and no reviewer was notified.</p>
            <button type="button" className="hp-btn-primary" onClick={onBack}>Return to MediCare</button>
          </section>
        ) : (
          <form className="hp-membership-form" onSubmit={requestReview}>
            <section className="hp-membership-card">
              <div className="hp-membership-section-heading"><span>01</span><div><h2>Applicant</h2><p>Using the details on your account.</p></div></div>
              <div className="hp-membership-account-grid">
                <div><small>Full name</small><strong>{fullName}</strong></div>
                <div><small>Username</small><strong>@{user?.username || "member"}</strong></div>
                <div><small>Email</small><strong>{user?.email || "—"}</strong></div>
              </div>
            </section>

            <section className="hp-membership-card">
              <div className="hp-membership-section-heading"><span>02</span><div><h2>What would you like to discuss?</h2><p>Select one or more benefit areas from the MediCare guide.</p></div></div>
              <div className="hp-benefit-choice-grid">
                {BENEFITS.map(benefit => (
                  <label className={`hp-benefit-choice${selectedBenefits.includes(benefit) ? " selected" : ""}`} key={benefit}>
                    <input type="checkbox" checked={selectedBenefits.includes(benefit)} onChange={() => toggleBenefit(benefit)} />
                    <span>{benefit}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="hp-membership-card">
              <div className="hp-membership-section-heading"><span>03</span><div><h2>Prepare documents</h2><p>PDF, JPEG, PNG, or WebP · maximum 10 MB per file.</p></div></div>
              <div className="hp-document-upload-list">
                {REQUIRED_DOCUMENTS.map(document => (
                  <label className="hp-document-upload" key={document.id}>
                    <span className="hp-document-upload-icon" aria-hidden="true">↑</span>
                    <span className="hp-document-upload-copy"><strong>{document.label} <em>Required for demo</em></strong><small>{document.hint}</small><small className="hp-file-name">{files[document.id]?.name || "Choose a file"}</small></span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={event => selectFile(document.id, event.target.files?.[0])} />
                  </label>
                ))}
              </div>
              <details className="hp-conditional-documents">
                <summary>Additional documents an underwriter may request</summary>
                <div className="hp-document-upload-list">
                  {CONDITIONAL_DOCUMENTS.map(document => (
                    <label className="hp-document-upload" key={document.id}>
                      <span className="hp-document-upload-icon" aria-hidden="true">↑</span>
                      <span className="hp-document-upload-copy"><strong>{document.label} <em>When requested</em></strong><small>{document.hint}</small><small className="hp-file-name">{files[document.id]?.name || "Optional for this demo"}</small></span>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={event => selectFile(document.id, event.target.files?.[0])} />
                    </label>
                  ))}
                </div>
              </details>
              {fileError && <p className="hp-membership-error" role="alert">{fileError}</p>}
            </section>

            <section className="hp-membership-card">
              <div className="hp-membership-section-heading"><span>04</span><div><h2>Photo confirmation</h2><p>Take a front-camera selfie before requesting review.</p></div></div>
              <FaceCapture onCaptureChange={setFaceCaptured} label="Applicant selfie" />
            </section>

            <div className="hp-membership-submit-row">
              <p>Premiums, acceptance, and document requirements are determined after benefit selection and underwriting. This action only demonstrates the human-review step.</p>
              <button type="submit" className="hp-btn-primary hp-review-button" disabled={!faceCaptured || !selectedBenefits.length || REQUIRED_DOCUMENTS.some(document => !files[document.id])}>
                Request human review
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
