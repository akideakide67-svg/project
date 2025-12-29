import React from "react";
import { formatDate } from '../utils/dateFormatter';

/**
 * Printable Report Component
 * Fully optimized for A4 printing and professional layout.
 */
const ReportPrintView = ({ report, patientName, doctorName = "Doctor" }) => {
  if (!report) return null;

  // Dynamic sections by type
  const typeSections = {
    "Report (Compte Rendu)": [
      ["Clinical Findings", report.clinicalFindings],
      ["Diagnosis", report.diagnosis],
      ["Treatment and Recommendations", report.treatmentAndRecommendations],
    ],
    "Medical Certificate": [
      ["Medical Examination Findings", report.medicalExaminationFindings],
      ["Recommendations", report.recommendations],
      ["Duration of Incapacity", report.durationOfIncapacity],
    ],
    "Referral Letter": [
      ["Referring Doctor Information", report.referringDoctorInfo],
      ["Reason for Referral", report.reasonForReferral],
      ["Clinical Findings and Results", report.clinicalFindingsAndResults],
      ["Treatment Given", report.treatmentGiven],
      ["Patient's Current Status", report.patientCurrentStatus],
      ["Treatment Goals and Plan", report.treatmentGoalsAndPlan],
    ],
  };

  const sectionsToRender = typeSections[report.type] || [];

  return (
    <div
      id="printable-report"
      className="bg-white text-black font-serif text-[15px] p-10 leading-relaxed"
    >
      {/* Header */}
      <header className="text-center mb-10">
        <h1 className="text-3xl font-bold text-primary">ClinicSys Medical Center</h1>
        <p>123 Health St, Wellness City</p>
        <p>Phone: (123) 456-7890</p>
      </header>

      {/* Title */}
      <h2 className="text-2xl font-bold text-center border-b-2 border-primary pb-2 mb-8">
        {report.type}
      </h2>

      {/* Basic patient info */}
      <div className="grid grid-cols-2 gap-x-8 mb-8">
        <p>
          <strong className="font-semibold">Patient Name:</strong> {patientName}
        </p>
        <p>
          <strong className="font-semibold">Date:</strong>{" "}
          {formatDate(report.date)}
        </p>
      </div>

      {/* Patient & history section */}
      <Section title="Patient Information" content={report.patientInfo} />
      <Section title="Medical History" content={report.medicalHistory} />

      {/* Dynamic sections */}
      {sectionsToRender.map(([title, content], i) => (
        <Section key={i} title={title} content={content} />
      ))}

      {/* Signature */}
      <footer className="mt-20 pt-8 border-t-2 border-primary text-left">
        <p className="font-semibold">Doctor's Signature:</p>
        <div className="h-16"></div>

        <p className="mt-2">_________________________</p>
        <p>Dr. {doctorName}</p>
      </footer>
    </div>
  );
};

/* Single Section Component */
const Section = ({ title, content }) => {
  if (!content) return null;

  return (
    <div className="mb-6 page-break-inside-avoid">
      <h3 className="text-lg font-bold text-primary mb-2 border-b border-slate-300 pb-1">
        {title}
      </h3>
      <p className="text-slate-700 whitespace-pre-wrap">{content}</p>
    </div>
  );
};

export default ReportPrintView;
