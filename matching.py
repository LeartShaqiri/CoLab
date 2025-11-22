"""
Complementary skill matching algorithm.
Finds users with skills that complement the requester's needs.
"""
from typing import List, Dict, Set, Tuple, Optional
from database import User, Skill
import json


def compute_complementary_match(
    requester: User,
    candidate: User,
    required_skills: Optional[List[str]] = None
) -> Tuple[float, Dict[str, any]]:
    """
    Compute a match score between requester and candidate based on complementary skills.
    
    Returns:
        Tuple of (match_score, match_details)
    """
    requester_skills: Set[str] = {s.name.lower() for s in requester.skills}
    candidate_skills: Set[str] = {s.name.lower() for s in candidate.skills}
    
    # If specific skills are required, use those; otherwise use requester's skills as needs
    if required_skills:
        needs_set = {s.lower() for s in required_skills}
    else:
        needs_set = requester_skills.copy()
    
    # Calculate different aspects of the match
    shared_skills = requester_skills.intersection(candidate_skills)
    complementary_skills = candidate_skills - requester_skills  # Skills candidate has that requester lacks
    covered_needs = needs_set.intersection(candidate_skills)  # How many needs the candidate covers
    missing_skills = needs_set - candidate_skills  # Needs not covered by candidate
    
    # Score components
    # 1. Skill coverage: How well candidate covers the required skills (0-1)
    coverage_score = len(covered_needs) / max(1, len(needs_set))
    
    # 2. Complementarity: How many unique skills candidate adds (normalized, 0-1)
    complement_score = min(1.0, len(complementary_skills) / 10.0)  # Normalize by expected max
    
    # 3. Shared skills bonus: Having some overlap is good for collaboration (0-0.3)
    shared_bonus = min(0.3, len(shared_skills) / 5.0)
    
    # 4. Availability match: Same timezone or flexible availability (0-0.2)
    availability_score = 0.0
    if requester.availability and candidate.availability:
        if candidate.availability.lower() == "any" or requester.availability.lower() == "any":
            availability_score = 0.2
        elif requester.timezone and candidate.timezone and requester.timezone == candidate.timezone:
            availability_score = 0.15
        elif requester.availability.lower() == candidate.availability.lower():
            availability_score = 0.1
    
    # Final weighted score (weights favor complementarity and coverage)
    final_score = (
        0.5 * coverage_score +      # Most important: covers needs
        0.3 * complement_score +    # Important: adds new skills
        0.15 * shared_bonus +       # Nice to have: some overlap
        0.05 * availability_score   # Bonus: can work together
    )
    
    match_details = {
        "coverage_score": round(coverage_score, 3),
        "complement_score": round(complement_score, 3),
        "shared_bonus": round(shared_bonus, 3),
        "availability_score": round(availability_score, 3),
        "complementary_skills": sorted([s for s in candidate_skills if s not in requester_skills]),
        "shared_skills": sorted(list(shared_skills)),
        "covered_needs": sorted(list(covered_needs)),
        "missing_skills": sorted(list(missing_skills)),
        "total_skills_candidate": len(candidate_skills),
        "total_skills_requester": len(requester_skills)
    }
    
    return round(final_score, 4), match_details


def find_best_matches(
    requester: User,
    all_users: List[User],
    required_skills: Optional[List[str]] = None,
    top_k: int = 10
) -> List[Tuple[User, float, Dict[str, any]]]:
    """
    Find the best complementary matches for a requester.
    
    Returns:
        List of tuples: (candidate_user, match_score, match_details)
        Sorted by score descending.
    """
    matches = []
    
    for candidate in all_users:
        if candidate.id == requester.id or not candidate.is_active:
            continue
        
        score, details = compute_complementary_match(requester, candidate, required_skills)
        matches.append((candidate, score, details))
    
    # Sort by score descending
    matches.sort(key=lambda x: x[1], reverse=True)
    
    return matches[:top_k]


def calculate_interest_match(
    user1_interests: List[str],
    user2_interests: List[str]
) -> float:
    """
    Calculate interest match percentage between two users.
    
    Returns:
        Match percentage (0.0 to 1.0)
    """
    if not user1_interests or not user2_interests:
        return 0.0
    
    # Normalize interests (remove # and lowercase for comparison)
    interests1 = {i.lower().replace('#', '') for i in user1_interests if i}
    interests2 = {i.lower().replace('#', '') for i in user2_interests if i}
    
    if not interests1 or not interests2:
        return 0.0
    
    # Calculate Jaccard similarity (intersection over union)
    intersection = len(interests1.intersection(interests2))
    union = len(interests1.union(interests2))
    
    if union == 0:
        return 0.0
    
    similarity = intersection / union
    return round(similarity, 4)


def get_interest_match_for_user(
    current_user: User,
    candidate: User
) -> float:
    """
    Get interest match percentage between current user and candidate.
    Handles JSON string parsing from database.
    """
    # Parse interests from database (could be JSON string or already parsed)
    current_interests = []
    candidate_interests = []
    
    if current_user.interests:
        if isinstance(current_user.interests, str):
            try:
                current_interests = json.loads(current_user.interests)
            except (json.JSONDecodeError, TypeError):
                current_interests = []
        else:
            current_interests = current_user.interests
    
    if candidate.interests:
        if isinstance(candidate.interests, str):
            try:
                candidate_interests = json.loads(candidate.interests)
            except (json.JSONDecodeError, TypeError):
                candidate_interests = []
        else:
            candidate_interests = candidate.interests
    
    return calculate_interest_match(current_interests, candidate_interests)

