# If you manually flush nat iptables on Android it can mess up hotspot connectivity which
# a network reset might not fix. The commands below restore connectivity (or a reboot).

sudo iptables -t nat -A POSTROUTING -j tetherctrl_nat_POSTROUTING
sudo iptables -t nat -A PREROUTING -j oem_nat_pre

