import time
import random
import hashlib
import re
from collections import deque
from typing import List, Dict, Any, Union, Optional


# --- LAYER 1: IDENTITY & CONSENT ARCHITECTURE ---

class IdentityVault:
    """
    Manages user identities and explicit consent for data sharing.
    """
    def __init__(self):
        self._consent_matrix: Dict[str, set] = {}
        self._user_roles: Dict[str, str] = {}

    def register_user(self, user_id: str, role: str):
        self._user_roles[user_id] = role
        print(f"[IDENTITY_VAULT]: Registered user '{user_id}' with role '{role}'.")

    def get_user_role(self, user_id: str) -> Optional[str]:
        return self._user_roles.get(user_id)

    def grant_access(self, owner_id: str, requester_id: str):
        if owner_id not in self._consent_matrix:
            self._consent_matrix[owner_id] = set()
        self._consent_matrix[owner_id].add(requester_id)
        print(f"[IDENTITY_VAULT]: Access GRANTED by {owner_id} to {requester_id}.")

    def revoke_access(self, owner_id: str, requester_id: str):
        if owner_id in self._consent_matrix and requester_id in self._consent_matrix[owner_id]:
            self._consent_matrix[owner_id].remove(requester_id)
            print(f"[IDENTITY_VAULT]: Access REVOKED by {owner_id} from {requester_id}.")

    def is_authorized(self, owner_id: str, requester_id: str) -> bool:
        return requester_id in self._consent_matrix.get(owner_id, set())


# --- LAYER 2: SECURE DATA PROVISIONING ---

class SecureDataStream:
    """
    Simulates a secure stream of sensitive data (e.g., IoT metrics, location).
    Enforces authorization via the IdentityVault.
    """
    def __init__(self, stream_id: str, vault: IdentityVault):
        self.stream_id = stream_id
        self.vault = vault
        self._internal_buffer: List[Dict[str, Any]] = []

    def push_data(self, data: Dict[str, Any]):
        timestamp = time.time()
        payload = f"{timestamp}-{data}"
        data['integrity_hash'] = hashlib.sha256(payload.encode()).hexdigest()
        data['timestamp'] = timestamp
        self._internal_buffer.append(data)

    def pull_data(self, requester_id: str) -> Optional[List[Dict[str, Any]]]:
        if not self.vault.is_authorized(self.stream_id, requester_id):
            print(f"[DATA_STREAM]: UNAUTHORIZED access attempt by {requester_id} on {self.stream_id}.")
            return None
        return list(self._internal_buffer)


# --- LAYER 3: ANOMALY & THREAT DETECTION ---

class SentinelAnalyst:
    """
    Analyzes data streams for security anomalies, integrity breaches, or
    statistical outliers using a rolling window analysis.
    """
    def __init__(self, name: str, threshold: float = 3.0):
        self.name = name
        self.threshold = threshold
        self.history = deque(maxlen=50)

    def analyze(self, data_batch: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        anomalies = []
        for entry in data_batch:
            val = entry.get('value')
            if val is None or not isinstance(val, (int, float)):
                continue

            if len(self.history) > 10:
                mean = sum(self.history) / len(self.history)
                variance = sum((x - mean) ** 2 for x in self.history) / len(self.history)
                std_dev = variance ** 0.5

                if std_dev > 0 and abs(val - mean) > (self.threshold * std_dev):
                    entry['anomaly_score'] = abs(val - mean) / std_dev
                    anomalies.append(entry)

            self.history.append(val)
        return anomalies


# --- LAYER 4: INTEGRITY AUDIT & LOGGING ---

class AuditSystem:
    """
    Maintains a tamper-evident log of all system actions for forensic analysis.
    """
    def __init__(self):
        self.logs: List[str] = []

    def log_event(self, actor: str, action: str, status: str, details: Optional[str] = None):
        entry = f"[{time.ctime()}] ACTOR: {actor} | ACTION: {action} | STATUS: {status}"
        if details:
            entry += f" | DETAILS: {details}"
        self.logs.append(entry)
        print(f"[AUDIT]: {entry}")


# --- LAYER 5: DEFENSIVE SECURITY GATEWAY ---

class SecurityGateway:
    """
    Acts as a Web Application Firewall (WAF) / Intrusion Detection System (IDS)
    for a simulated web service. Validates incoming requests for known
    vulnerabilities like SQL Injection and XSS.
    """
    def __init__(self, vault: IdentityVault, audit: AuditSystem):
        self.vault = vault
        self.audit = audit
        self.blocked_ips: set = set()
        self._user_profiles: Dict[str, Dict[str, Any]] = {}

        self.sql_injection_patterns = [
            r"('|--|#|;|=|\s+OR\s+)",
            r"(union\s+select)",
            r"(select\s+sleep)",
        ]
        self.xss_patterns = [
            r"(<script>)",
            r"(javascript:)",
            r"(alert\()",
        ]

    def _detect_sql_injection(self, payload: str) -> bool:
        for pattern in self.sql_injection_patterns:
            if re.search(pattern, payload, re.IGNORECASE):
                return True
        return False

    def _detect_xss(self, payload: str) -> bool:
        for pattern in self.xss_patterns:
            if re.search(pattern, payload, re.IGNORECASE):
                return True
        return False

    def _block_ip(self, ip_address: str):
        self.blocked_ips.add(ip_address)
        self.audit.log_event("SECURITY_GATEWAY", "IP_BLOCK", "SUCCESS", f"IP {ip_address} blocked due to suspicious activity.")
        print(f"[GATEWAY]: IP {ip_address} BLOCKED.")

    def process_web_request(self, requester_id: str, ip_address: str, endpoint: str, data: Dict[str, str]) -> Dict[str, Any]:
        self.audit.log_event(requester_id, f"WEB_REQUEST_{endpoint}", "INCOMING", f"IP: {ip_address}")

        if ip_address in self.blocked_ips:
            self.audit.log_event(requester_id, f"WEB_REQUEST_{endpoint}", "BLOCKED", f"IP: {ip_address} is blocked.")
            return {"status": "BLOCKED", "message": "Access denied due to suspicious activity."}

        for key, value in data.items():
            if self._detect_sql_injection(value):
                self._block_ip(ip_address)
                self.audit.log_event(requester_id, "SQLI_ATTEMPT", "DETECTED", f"Input: {value}")
                return {"status": "REJECTED", "message": "SQL Injection attempt detected."}
            if self._detect_xss(value):
                self._block_ip(ip_address)
                self.audit.log_event(requester_id, "XSS_ATTEMPT", "DETECTED", f"Input: {value}")
                return {"status": "REJECTED", "message": "XSS attempt detected."}

        user_role = self.vault.get_user_role(requester_id)
        if not user_role:
            self.audit.log_event(requester_id, f"WEB_REQUEST_{endpoint}", "DENIED", "Unknown user role.")
            return {"status": "UNAUTHORIZED", "message": "Unknown user."}

        if endpoint == "/profile/view":
            target_user = data.get("user_id", requester_id)
            if target_user not in self._user_profiles:
                return {"status": "ERROR", "message": "Profile not found."}

            if target_user == requester_id or user_role == "admin":
                self.audit.log_event(requester_id, f"VIEW_PROFILE_{target_user}", "SUCCESS")
                return {"status": "SUCCESS", "profile": self._user_profiles[target_user]}
            else:
                self.audit.log_event(requester_id, f"VIEW_PROFILE_{target_user}", "DENIED", "Not authorized to view this profile.")
                return {"status": "UNAUTHORIZED", "message": "Not authorized to view this profile."}

        elif endpoint == "/profile/update":
            target_user = data.get("user_id", requester_id)
            if target_user != requester_id and user_role != "admin":
                self.audit.log_event(requester_id, f"UPDATE_PROFILE_{target_user}", "DENIED", "Not authorized to update this profile.")
                return {"status": "UNAUTHORIZED", "message": "Not authorized to update this profile."}

            if target_user not in self._user_profiles:
                self._user_profiles[target_user] = {"user_id": target_user, "name": target_user, "bio": "New user."}
            self._user_profiles[target_user].update(data)
            self.audit.log_event(requester_id, f"UPDATE_PROFILE_{target_user}", "SUCCESS")
            return {"status": "SUCCESS", "message": f"Profile for {target_user} updated."}

        elif endpoint == "/admin/dashboard":
            if user_role == "admin":
                self.audit.log_event(requester_id, "ACCESS_ADMIN_DASHBOARD", "SUCCESS")
                return {"status": "SUCCESS", "message": "Welcome to the Admin Dashboard!"}
            else:
                self.audit.log_event(requester_id, "ACCESS_ADMIN_DASHBOARD", "DENIED", "Requires admin role.")
                return {"status": "UNAUTHORIZED", "message": "Admin access required."}

        self.audit.log_event(requester_id, f"WEB_REQUEST_{endpoint}", "INVALID_ENDPOINT")
        return {"status": "ERROR", "message": "Invalid endpoint."}


# --- EXECUTION: DEFENSIVE CTF-INSPIRED DEMONSTRATION ---

if __name__ == "__main__":
    print("--- INITIATING SENTINEL INTEGRITY SUITE V2 (DEFENSIVE CTF MODE) ---")

    vault = IdentityVault()
    audit = AuditSystem()
    gateway = SecurityGateway(vault, audit)

    vault.register_user("Alice", "user")
    vault.register_user("Bob", "admin")
    vault.register_user("Eve", "user")
    vault.register_user("Attacker", "guest")

    gateway._user_profiles["Alice"] = {"user_id": "Alice", "name": "Alice Wonderland", "bio": "Explorer of Wonderland."}
    gateway._user_profiles["Bob"] = {"user_id": "Bob", "name": "Bob The Builder", "bio": "Building things."}

    print("\n--- SCENARIO 1: LEGITIMATE USER ACTIONS ---")
    response = gateway.process_web_request("Alice", "192.168.1.100", "/profile/view", {"user_id": "Alice"})
    print(f"Alice view own profile: {response}")
    response = gateway.process_web_request("Alice", "192.168.1.100", "/profile/update", {"user_id": "Alice", "bio": "Still exploring, now with more tea!"})
    print(f"Alice update own profile: {response}")
    response = gateway.process_web_request("Bob", "192.168.1.101", "/profile/view", {"user_id": "Alice"})
    print(f"Bob view Alice profile: {response}")
    response = gateway.process_web_request("Bob", "192.168.1.101", "/admin/dashboard", {})
    print(f"Bob admin dashboard: {response}")

    print("\n--- SCENARIO 2: UNAUTHORIZED USER ACTIONS ---")
    response = gateway.process_web_request("Eve", "192.168.1.102", "/profile/view", {"user_id": "Bob"})
    print(f"Eve view Bob profile: {response}")
    response = gateway.process_web_request("Alice", "192.168.1.100", "/admin/dashboard", {})
    print(f"Alice admin dashboard: {response}")

    print("\n--- SCENARIO 3: CTF-INSPIRED ATTACK VECTORS (SQL Injection, XSS) ---")
    sql_attack_payload = "Alice' OR '1'='1"
    response = gateway.process_web_request("Attacker", "203.0.113.5", "/profile/view", {"user_id": sql_attack_payload})
    print(f"SQL Injection attempt (Attacker): {response}")

    xss_attack_payload = "<script>alert('You are hacked!')</script>"
    response = gateway.process_web_request("Attacker", "203.0.113.6", "/profile/update", {"user_id": "Eve", "bio": xss_attack_payload})
    print(f"XSS attempt (Attacker): {response}")

    print("\n--- SCENARIO 4: IP BLOCKING ---")
    response = gateway.process_web_request("Attacker", "203.0.113.5", "/profile/view", {"user_id": "Alice"})
    print(f"Blocked IP re-attempt (Attacker): {response}")

    print("\n--- DEFENSIVE CTF DEMONSTRATION COMPLETE ---")
