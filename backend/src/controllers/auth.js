const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { User, Organization } = require('../models');

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  fullName: Joi.string().required(),
  organizationName: Joi.string().required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const generateTokens = (userId, organizationId, role) => {
  const payload = {
    sub: userId,
    org: organizationId,
    role: role
  };
  
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  
  return { accessToken, refreshToken };
};

const register = async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { email, password, fullName, organizationName } = value;
    
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    // Create organization - fix the destructuring issue
    const orgSlug = organizationName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const organizationResult = await Organization.create({
      name: organizationName,
      slug: orgSlug,
      plan_type: 'free'
    });
    
    // Handle the organization result properly
    const organization = Array.isArray(organizationResult) ? organizationResult[0] : organizationResult;
    
    // Create user - fix the destructuring issue
    const passwordHash = await bcrypt.hash(password, 12);
    const userResult = await User.create({
      organization_id: organization.id,
      email,
      password_hash: passwordHash,
      full_name: fullName,
      role: 'admin'
    });
    
    // Handle the user result properly
    const user = Array.isArray(userResult) ? userResult[0] : userResult;
    
    const tokens = generateTokens(user.id, organization.id, user.role);
    
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug
      },
      ...tokens
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

const login = async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { email, password } = value;
    
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    await User.updateLastLogin(user.id);
    
    const organization = await Organization.findById(user.organization_id);
    const tokens = generateTokens(user.id, user.organization_id, user.role);
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug
      },
      ...tokens
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

module.exports = { register, login };