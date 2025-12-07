#include <Wire.h>

const byte MMA8452Q_ADDRESS = 0x1D; // SA0 pulled high on SparkFun board
const byte MMA8452Q_WHO_AM_I = 0x0D;
const byte MMA8452Q_CTRL_REG1 = 0x2A;
const byte MMA8452Q_CTRL_REG2 = 0x2B;
const byte MMA8452Q_XYZ_DATA_CFG = 0x0E;
const byte MMA8452Q_OUT_X_MSB = 0x01;

const byte EXPECTED_ID = 0x2A;
const float COUNTS_PER_G = 4096.0f; // 2 g scale, 14-bit mode

unsigned long lastSampleMs = 0;
const unsigned long samplePeriodMs = 50; // 20 Hz logging

// Gesture thresholds
const float bumpThresholdG = 2.2f;        // Z-axis spike for flap
const unsigned long bumpCooldownMs = 200; // Debounce bump events
const float tiltOnDeg = 30.0f;            // Angle to trigger tilt event
const float tiltOffDeg = 20.0f;           // Angle to clear latch (hysteresis)

// Gesture state
unsigned long lastBumpMs = 0;
int lastTiltDir = 0; // -1 left, 0 none, +1 right
float lastAngleDeg = 0.0f;
unsigned long lastAngleMs = 0;

void setup()
{
    Serial.begin(115200);
    while (!Serial)
    {
        ;
    }

    Serial.println(F("SparkFun MMA8452Q quick test"));

    Wire.begin();
    Wire.setClock(400000); // Sensor supports 400 kHz fast mode

    if (!initMMA8452Q())
    {
        Serial.println(F("Initialization failed. Check wiring and power."));
        while (true)
        {
            delay(1000);
        }
    }

    Serial.println(F("Sensor ready. Logging X/Y/Z in g (raw counts)."));
}

void loop()
{
    if (millis() - lastSampleMs < samplePeriodMs)
    {
        return;
    }
    lastSampleMs = millis();

    float x = 0.0f;
    float y = 0.0f;
    float z = 0.0f;
    int16_t rawX = 0;
    int16_t rawY = 0;
    int16_t rawZ = 0;

    if (!readAcceleration(rawX, rawY, rawZ, x, y, z))
    {
        Serial.println(F("Read error"));
        return;
    }

    detectBump(z);
    detectTilt(x, y, z);
}

bool initMMA8452Q()
{
    byte id = 0;
    if (!readRegister(MMA8452Q_WHO_AM_I, id))
    {
        Serial.println(F("WHO_AM_I read failed"));
        return false;
    }

    if (id != EXPECTED_ID)
    {
        Serial.print(F("Unexpected WHO_AM_I: 0x"));
        Serial.println(id, HEX);
        return false;
    }

    if (!standbyMMA8452Q())
    {
        return false;
    }

    // +/-2g range, high-resolution oversampling
    if (!writeRegister(MMA8452Q_XYZ_DATA_CFG, 0x00))
    {
        return false;
    }

    // Control register 2: high-res mode
    if (!writeRegister(MMA8452Q_CTRL_REG2, 0x02))
    {
        return false;
    }

    // Activate, 100 Hz ODR (0b0100), low-noise off
    byte ctrl1 = 0x01 | (0x02 << 3);
    if (!writeRegister(MMA8452Q_CTRL_REG1, ctrl1))
    {
        return false;
    }

    delay(10);
    return true;
}

bool standbyMMA8452Q()
{
    byte current = 0;
    if (!readRegister(MMA8452Q_CTRL_REG1, current))
    {
        return false;
    }

    if ((current & 0x01) == 0)
    {
        return true; // Already in standby
    }

    byte standbyValue = current & ~0x01;
    if (!writeRegister(MMA8452Q_CTRL_REG1, standbyValue))
    {
        return false;
    }

    delay(1);
    return true;
}

bool readAcceleration(int16_t &rawX, int16_t &rawY, int16_t &rawZ, float &x, float &y, float &z)
{
    byte buffer[6] = {0};
    if (!readRegisters(MMA8452Q_OUT_X_MSB, buffer, sizeof(buffer)))
    {
        return false;
    }

    rawX = (int16_t)((buffer[0] << 8) | buffer[1]) >> 2;
    rawY = (int16_t)((buffer[2] << 8) | buffer[3]) >> 2;
    rawZ = (int16_t)((buffer[4] << 8) | buffer[5]) >> 2;

    x = rawX / COUNTS_PER_G;
    y = rawY / COUNTS_PER_G;
    z = rawZ / COUNTS_PER_G;
    return true;
}

bool writeRegister(byte reg, byte value)
{
    Wire.beginTransmission(MMA8452Q_ADDRESS);
    Wire.write(reg);
    Wire.write(value);
    return Wire.endTransmission() == 0;
}

bool readRegister(byte reg, byte &value)
{
    if (!readRegisters(reg, &value, 1))
    {
        return false;
    }
    return true;
}

bool readRegisters(byte startReg, byte *buffer, byte length)
{
    Wire.beginTransmission(MMA8452Q_ADDRESS);
    Wire.write(startReg);
    if (Wire.endTransmission(false) != 0)
    {
        return false;
    }

    byte received = Wire.requestFrom(MMA8452Q_ADDRESS, length, true);
    if (received != length)
    {
        return false;
    }

    for (byte i = 0; i < length; ++i)
    {
        buffer[i] = Wire.read();
    }
    return true;
}

void detectBump(float zG)
{
    unsigned long nowMs = millis();
    if (nowMs - lastBumpMs < bumpCooldownMs)
    {
        return;
    }

    if (zG > bumpThresholdG)
    {
        Serial.println(F("BUMP"));
        lastBumpMs = nowMs;
    }
}

void detectTilt(float xG, float yG, float zG)
{
    unsigned long nowMs = millis();
    // Calculate tilt angle around the X-axis relative to gravity
    // Angle sign: positive = right tilt, negative = left tilt
    float angleDeg = atan2f(xG, sqrtf((yG * yG) + (zG * zG))) * (180.0f / PI);

    // Angular velocity (deg/s)
    float velocityDegPerSec = 0.0f;
    if (lastAngleMs != 0)
    {
        unsigned long dt = nowMs - lastAngleMs;
        if (dt > 0)
        {
            velocityDegPerSec = (angleDeg - lastAngleDeg) * 1000.0f / dt;
        }
    }
    lastAngleDeg = angleDeg;
    lastAngleMs = nowMs;

    // Hysteresis: enter when beyond tiltOnDeg, exit when within tiltOffDeg
    if (angleDeg > tiltOnDeg && lastTiltDir != 1)
    {
        // Right tilt event
        Serial.print(F("TILT_RIGHT:"));
        Serial.print((int)abs(velocityDegPerSec));
        Serial.print(F(":"));
        Serial.println(angleDeg, 1);
        lastTiltDir = 1;
    }
    else if (angleDeg < -tiltOnDeg && lastTiltDir != -1)
    {
        // Left tilt event
        Serial.print(F("TILT_LEFT:"));
        Serial.print((int)abs(velocityDegPerSec));
        Serial.print(F(":"));
        Serial.println(angleDeg, 1);
        lastTiltDir = -1;
    }
    else if (fabs(angleDeg) < tiltOffDeg)
    {
        lastTiltDir = 0;
    }
}
