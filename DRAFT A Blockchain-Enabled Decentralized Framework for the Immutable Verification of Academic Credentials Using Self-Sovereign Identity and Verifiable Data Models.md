# **A Blockchain-Enabled Decentralized Framework for the Immutable Verification of Academic Credentials Using Self-Sovereign Identity and Verifiable Data Models**

In Partial Fulfillment of the Requirements for the Degree of Bachelor of Science in Computer Science

By:

**Frederick Ian Aranico**

**Karl U. Romero**

**Rav Anthony E. Rosauro**

**Rainier Jean C. Tamayo**

# **May 2026**

# **TABLE OF CONTENTS**

# **CHAPTER I**

# **THE PROBLEM AND ITS BACKGROUND…………………………………………………………………………2**

# A. Introduction……………………………………………………………………………………………………………………………..2

# B. Purpose and Description of the Study……………………………………………………………………………………2

# C. Objectives of the Study…………………………………………………………………………………………………………..3

# D. Significance of the Study…………………………………………………………………………………………………………3

# E. Scope and Limitations……………………………………………………………………………………………………………..4

# F. Conceptual Framework……………………………………………………………………………………………………………4

# G. Operational Definition of Terms……………..……………………………………………………………………………..5

# **Chapter II**

# **Review of Related Literature and Studies……………………………………………………………………..5**

# A. Introduction……………………………………………………………………………………………………………………………..5

# B. Foundational Concepts and Theoretical Background…………………………….……………………………6

# C. Existing Approaches and Related Systems…………………………………………………………………………..6

# D.Relevant Techniques, Models, or Analysis Methods……………………………..………………………………7

# E.Evaluation Metrics and Performance Considerations………………………………………………………..….7

# F. Synthesis of Literature and Identified Research Gaps………………………………………………………….8

# **CHAPTER III**

# **METHODOLOGY……………………………………………………………………………………………………………..8**

# A. Research Design………………………………………………………………………………………………………….…………..8

# B. Data Collection / Dataset Strategy…………………………………………………………………………………….…..9

# C. System Architecture / Methodological Framework..……………………………………………………….…..9

# D. Data Preprocessing……………………………………………………………………………………………………………….10

# E. Algorithm Description and Cryptanalysis Procedure (Optimization Logic)……………………..10

# F. Experimental Implementation Phases (Training and Execution) ………………………………….……..11

# G. Evaluation Metrics and Criteria ...................................................................................................... 12

# **References........................................................................................................................13**

# **CHAPTER I.**

# **THE PROBLEM AND ITS BACKGROUND**

**A. Introduction**

The basis of information security is the preservation of data integrity and authenticity. It has traditionally developed out of manual methods of substitution into advanced digital algorithms \[1\]. Modern systems use higher mathematical changes; however, traditional centralized databases provide the necessary mathematical theory on how data structures are related to administrative secrecy \[2\]. One of these significant developments, the Ethereum based digital certificate system, was a great development as a practical method for maintaining academic records without a central authority \[14\]. Unlike centralized records, in which individual institutions control the data instead of the graduates, a blockchain based system encrypts academic transactions with the help of a decentralized ledger \[3\]. This system was developed to confuse the centralized nature of traditional record keeping characteristic of educational institutions \[7\].

Although traditional academic record management traditionally has a strong reputation regarding its stability, it is not resistant to forgery or unauthorized alteration. The theory of decentralized systems proposed by Nakamoto states that a network that removes the single point of failure is less vulnerable to attack \[4\]. The major weakness of current certificate authentication is that it can mask the administrative errors of individual offices but maintain the vulnerability of the physical document \[5\]. There is predictable regularity in the way academic credentials are forged, which can be used by an adversary to reconstruct a fake degree without a known verification key \[15\]. This can be mitigated given a sufficiently large blockchain network to obtain a consensus profile \[7\].

The issue that will be tackled in the research is the existence of recognizable security gaps in centralized credential verification. In spite of the fact that the extant literature is often able to discuss simple database encryption, the efficacy of decentralized identifiers (DIDs) and verifiable credentials is still worth comparing \[8\], \[9\]. This paper concentrates on the automation of the verification of these academic records and explains that the structural security of educational credentials is threatened by the predictable nature of manual forgery \[15\].

**B. Purpose and Description of the Study**

The main goal of the study is to construct and test an automated computational model that can verify academic credentials using decentralized identity and blockchain storage. The research seeks to show that the calculation of cryptographic proofs for diplomas can be computationally viable through the Ethereum Virtual Machine and not by manual verification \[2\]. The research will be initiated by introducing a system where universities issue signed credentials as digital objects stored on the InterPlanetary File System (IPFS) to ensure cost efficiency and decentralized availability \[6\]. Next, there will be a verification portal designed to check the cryptographic signature of these objects against a public ledger \[14\]. By matching these digital signatures to a registry of authorized institutional DIDs, the system will use a heuristic scoring function to further and further revise the verification status of the record \[11\].

**C.   Objectives of the Study**  

The general purpose of this research is to develop and test a system that verifies academic records using blockchain technology, allowing credentials to be authenticated without prior knowledge of institutional databases. To complete this broad goal, the research will follow the following narrow objectives:

* Create a working Decentralized Identifier (DID) system that allows users to manage their own cryptographic keys and digital identities \[8\].  
* Develop and figure out a detailed smart contract architecture to store the hashes of issued credentials on a public ledger \[14\].  
* Develop a verification program which retrieves metadata from IPFS and matches it to on chain proofs, thus determining the relative validity of the record \[6\].  
* Evaluate the effectiveness of the suggested framework by determining the success rate of accurately verified credentials in a range of network conditions \[13\].  
* Find out how long the verification process takes to achieve a high deciphering rate of trust for employers using the blockchain technique \[15\].

**D.   Significance of the Study**  

The analysis of decentralized systems provides necessary information about the strengths of encryption that does not hide data behind a single authority. This research has implications for the following constituencies:

* **Academic Institutions:** The work contributes to the field of educational management by introducing an open source, algorithmic model of credential issuance \[3\]. It serves as a pedagogical standard to explain how blockchain weakens the threat of diploma fraud and thus points at the importance of decentralization in institutional design \[12\].  
* **Cybersecurity Professionals:** The results of the research outline the advantages of self sovereign identity. The presented idea that the ownership of data can be as crucial as the security of the data itself can be directly applied to the evaluation of vulnerabilities in modern identity systems \[8\].  
* **Algorithm Developers:** The research provides experimental evidence into the effectiveness of smart contract based automation \[14\]. Pattern recognition and natural language processors (NLP) developers can utilize these discoveries to understand how scoring capabilities can be used to salvage data integrity in noisy digital environments \[13\].

**E.   Scope and Limitations**  

**Scope:** 

The research paper solely examines the verification of academic credentials using the W3C Verifiable Credentials and DID standards \[8\], \[9\]. The implementation is limited to the Ethereum compatible networks and utilizes IPFS for storage \[6\]. The test is limited to the analysis of simulated transcripts based on standard university formats \[11\].

**Limitations:**

* **Network Dependency:** The verification process is highly dependent on the size of the available network nodes and IPFS gateways \[6\].  
* **Gas Costs:** A loss in accuracy can thus occur in case of periods of high network congestion where transaction costs increase \[2\].  
* **User Responsibility:** The system relies on the user to maintain their private keys. It can therefore not properly recover access if the student loses their cryptographic identity \[14\].  
* **Convergence Efficiency:** There is a possibility that institutional resistance can lead to a local optimum that produces partially integrated systems instead of the global optimum of universal adoption \[7\].

**F.   Conceptual Framework**  

**![][image1]**

Figure 1: The IPO Model Framework.  

This analysis works under a linear input, process, and output system. The processing begins with the input stage, which entails the compilation of institutional data and student DIDs \[3\]. The research process is the main part: the Verification Algorithm of Decentralized Credentials. This element takes the digital credential and counts the validity of the signature against the blockchain ledger \[14\]. The hypothetical smart contract will then undergo an execution process to maximize the trust score of the record \[13\]. The results are given in the output phase: the verified status and the immutable audit trail \[15\]. They are compared to the initial records to calculate accuracy measures thereby proving the efficacy of the blockchain method \[7\].

## **G.   Operational Definition of Terms**

To ensure clarity and precision, the following technical terms are defined within the context of this study:

* **Blockchain:** A decentralized, immutable ledger that records academic transactions and credential hashes across a peer to peer network to prevent unauthorized data alteration.  
* **Decentralized Identifier (DID):** A new type of identifier that enables verifiable, decentralized digital identity, allowing students and institutions to prove ownership of their cryptographic keys.  
* **InterPlanetary File System (IPFS):** A peer to peer hypermedia protocol designed to preserve and grow humanity's data by making the web upgradeable, used in this study for the decentralized storage of credential metadata.  
* **Smart Contract:** Self executing code with the terms of the agreement directly written into lines of code, residing on the blockchain to automate the issuance and verification of academic records.  
* **Verifiable Credential (VC):** A digital representation of a physical document that is cryptographically signed by an issuer, allowing a holder to prove its authenticity to a verifier without contacting the original source.  
* **Zero Knowledge Proof (ZKP):** A cryptographic method by which one party can prove to another that a statement is true without revealing any information beyond the validity of the statement itself.  
* **Immutable Ledger:** A digital record of transactions that, once entered, cannot be changed, deleted, or altered, ensuring the permanent integrity of academic history.  
* **Self Sovereign Identity (SSI):** An approach to digital identity that gives individuals control over their digital identities without relying on a centralized authority.

**References:**

\[1\] W. Stallings, *Cryptography and Network Security: Principles and Practice*, 7th ed., Pearson, 2017\.

\[2\] A. M. Antonopoulos and G. Wood, *Mastering Ethereum: Building Smart Contracts and DApps*, O'Reilly Media, 2018\.

\[3\] M. Turkanovic, et al., "EduCTX: A Blockchain-Based Higher Education Credit Platform," *IEEE Access*, vol. 6, pp. 5112–5127, 2018\.

\[4\] S. Nakamoto, "Bitcoin: A Peer-to-Peer Electronic Cash System," 2008\. \[Online\]. Available: [https://bitcoin.org/bitcoin.pdf](https://bitcoin.org/bitcoin.pdf)

\[5\] B. M. Nguyen, et al., "Towards a blockchain-based certificate authentication system in Vietnam," *IEEE Access*, 2018\.

\[6\] J. Benet, "IPFS \- Content Addressed, Versioned, P2P File System," *arXiv preprint arXiv:1407.3561*, 2014\.

\[7\] R. A. Alammary, et al., "Blockchain Based Academic Record Management Systems: A Systematic Review," *Applied Sciences*, 2019\.

\[8\] W3C, "Decentralized Identifiers (DIDs) v1.0," 2022\. \[Online\]. Available: [https://www.w3.org/TR/did-core/](https://www.w3.org/TR/did-core/)

\[9\] W3C, "Verifiable Credentials Data Model v1.1," 2021\. \[Online\]. Available: [https://www.w3.org/TR/vc-data-model/](https://www.w3.org/TR/vc-data-model/)

\[10\] S. S. Srivastava and N. Gupta, "A review on Playfair cipher and its variants," *IJCA*, vol. 34, no. 1, 2011\.

\[11\] S. Sanjekar and B. M. Patil, "Securing Educational Document Using Blockchain & IPFS," *NeuroQuantology*, vol. 20, no. 9, 2022\.

\[12\] H. Kendrick, "Blockchain Technology's Potential in Special Education Records Management," *MGA School of Computing*, 2024\.

\[13\] M. M. Rahman, et al., "A Zero-Knowledge Proof-Enabled Blockchain-Based Academic Record Verification System," *Sensors*, vol. 25, no. 11, 2025\.

\[14\] T. T. Huynh and D. K. Pham, "EUNICERT: Ethereum Based Digital Certificate Verification System," *International Journal of Science and Research*, 2021\.

\[15\] C. M. L. Elimu, "A Comprehensive Blockchain-Based System for Educational Qualifications Management to Counter Forgery," *IEEE Xplore*, 2025\.

[image1]: <data:image/png;base64,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>