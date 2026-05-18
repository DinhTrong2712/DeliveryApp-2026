using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace DeliveryApp.API.Hubs;

[Authorize]
public class DeliveryHub : Hub
{
    public async Task JoinShipperGroup(string shipperId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"shipper-{shipperId}");
    }

    public async Task JoinAccountantGroup()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "accountants");
    }
}
