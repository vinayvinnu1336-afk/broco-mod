namespace BroCoMod.Domain.Exceptions;

public class DataIsolationViolationException : Exception
{
    public DataIsolationViolationException(string message) : base(message)
    {
    }

    public DataIsolationViolationException(string message, Exception innerException) : base(message, innerException)
    {
    }
}
