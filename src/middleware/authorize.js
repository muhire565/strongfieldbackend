export const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.profile) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // allowedRoles can be a string 'admin' or array ['admin', 'sales']
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(req.profile.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};
